"""
Тести для сканера звітів ReportScanner:
- Парсинг імен файлів з різними варіаціями дат і форматів
- Дедуплікація версій звітів (перевага найновішого таймстемпу)
- Сканування багаторівневих вкладених ZIP-архівів без розпакування на диск
- Зчитування вмісту файлів (диск, основний ZIP, вкладений ZIP)
"""

import io
import os
import tempfile
import unittest
import zipfile
from worker.scanner import ReportScanner, FileReportInfo


class TestScannerAndDeduplication(unittest.TestCase):

    def test_parse_filename_standard(self):
        """Парсинг стандартного імені файлу з датою у форматі YYYY-MM-DD HH:MM:SS."""
        fname = "32673400_460140032673400S010011510000006122025.XML_2026-06-05 16:47:46.xml"
        res = ReportScanner.parse_filename(fname)
        self.assertIsNotNone(res)
        edrpou, form, ts = res
        self.assertEqual(edrpou, "32673400")
        self.assertEqual(form, "S0100115")
        self.assertEqual(ts, "2026-06-05 16:47:46")

    def test_parse_filename_with_slashes_and_dots(self):
        """Парсинг імені файлу з косими рисками або крапками у таймстемпі."""
        fname = "00290771_230060000290771S010021510000137122025.XML_2026-02-24 06/22/26.xml"
        res = ReportScanner.parse_filename(fname)
        self.assertIsNotNone(res)
        edrpou, form, ts = res
        self.assertEqual(edrpou, "00290771")
        self.assertEqual(form, "S0100215")
        self.assertEqual(ts, "2026-02-24 06:22:26")

        fname2 = "12345678_800010012345678S010401010000001122025.xml_2026.04.15 10.30.00.xml"
        res2 = ReportScanner.parse_filename(fname2)
        self.assertIsNotNone(res2)
        edrpou2, form2, ts2 = res2
        self.assertEqual(edrpou2, "12345678")
        self.assertEqual(form2, "S0104010")
        self.assertEqual(ts2, "2026-04-15 10:30:00")

    def test_parse_filename_fallback_no_timestamp(self):
        """Парсинг імені без таймстемпу у хвості — призначає епоху 1970-01-01."""
        fname = "31316718_800010031316718S010335510000660122025.xml"
        res = ReportScanner.parse_filename(fname)
        self.assertIsNotNone(res)
        edrpou, form, ts = res
        self.assertEqual(edrpou, "31316718")
        self.assertEqual(form, "S0103355")
        self.assertEqual(ts, "1970-01-01 00:00:00")

    def test_parse_filename_invalid_returns_none(self):
        """Некоректні імена файлів повертають None."""
        self.assertIsNone(ReportScanner.parse_filename("random_notes.txt"))
        self.assertIsNone(ReportScanner.parse_filename("report_2025.xml"))

    def test_deduplication_keeps_latest_timestamp(self):
        """При наявності кількох версій одного звіту перемагає звіт з найновішим таймстемпом."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_old = "32673400_460140032673400S010011510000006122025.XML_2026-01-10 10:00:00.xml"
            file_new = "32673400_460140032673400S010011510000006122025.XML_2026-05-20 18:30:00.xml"
            file_other = "32673400_460140032673400S010021510000006122025.XML_2026-02-01 12:00:00.xml"

            for f in [file_old, file_new, file_other]:
                with open(os.path.join(tmpdir, f), "w", encoding="utf-8") as fp:
                    fp.write("<DECLAR/>")

            scanned = ReportScanner.scan_directory(tmpdir)
            self.assertEqual(len(scanned), 2)  # S0100115 та S0100215

            # Перевіряємо, що для S0100115 обрано саме новіший
            f1_info = next(item for item in scanned if item.form_code == "S0100115")
            self.assertEqual(f1_info.timestamp, "2026-05-20 18:30:00")
            self.assertEqual(f1_info.filename, file_new)

    def test_scan_zip_with_nested_subzips_and_reading(self):
        """Сканування та читання з багаторівневого ZIP без розпакування на диск."""
        with tempfile.TemporaryDirectory() as tmpdir:
            master_zip_path = os.path.join(tmpdir, "master.zip")

            # Створюємо вкладений підархів 1 (Ф1)
            sub1_buf = io.BytesIO()
            with zipfile.ZipFile(sub1_buf, "w", zipfile.ZIP_DEFLATED) as sub1_zf:
                xml_content1 = b"<DECLAR><DECLARBODY><A1000>555</A1000></DECLARBODY></DECLAR>"
                sub1_zf.writestr("32673400_...S0100115...XML_2026-05-01 10:00:00.xml", xml_content1)

            # Створюємо вкладений підархів 2 (Ф2)
            sub2_buf = io.BytesIO()
            with zipfile.ZipFile(sub2_buf, "w", zipfile.ZIP_DEFLATED) as sub2_zf:
                xml_content2 = b"<DECLAR><DECLARBODY><A2000>777</A2000></DECLARBODY></DECLAR>"
                sub2_zf.writestr("32673400_...S0100215...XML_2026-05-02 12:00:00.xml", xml_content2)

            # Пакуємо все в master.zip
            with zipfile.ZipFile(master_zip_path, "w", zipfile.ZIP_DEFLATED) as master_zf:
                master_zf.writestr("FG_2025_S0100115.zip", sub1_buf.getvalue())
                master_zf.writestr("FG_2025_S0100215.zip", sub2_buf.getvalue())

            # Скануємо
            scanned = ReportScanner.scan_zip(master_zip_path)
            self.assertEqual(len(scanned), 2)

            # Перевіряємо читання контенту прямо з підархівів через read_file_content
            info_f1 = next(item for item in scanned if item.form_code == "S0100115")
            raw1 = ReportScanner.read_file_content(info_f1)
            self.assertEqual(raw1, b"<DECLAR><DECLARBODY><A1000>555</A1000></DECLARBODY></DECLAR>")

            info_f2 = next(item for item in scanned if item.form_code == "S0100215")
            raw2 = ReportScanner.read_file_content(info_f2)
            self.assertEqual(raw2, b"<DECLAR><DECLARBODY><A2000>777</A2000></DECLARBODY></DECLAR>")


if __name__ == "__main__":
    unittest.main()
