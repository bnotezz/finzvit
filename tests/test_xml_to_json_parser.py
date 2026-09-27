import os
import sys
import unittest
import zipfile

# Додаємо корінь проєкту до шляхів імпорту
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from worker.scanner import ReportScanner
from worker.parsers import ParserRegistry, ParserF1, ParserF2, ParserF3, ParserF3Indirect, ParserF4
from worker.meta_builder import CompanyMetaBuilder
from worker.run_worker import _process_zip_master

class TestXmlToJsonParser(unittest.TestCase):
    """
    Тести перетворення XML -> JSON та парсингу офіційних форм
    для двох підприємств: ТзОВ "Кормотех" (32673400) та ТОВ "Нова Пошта" (31316718).
    """

    @classmethod
    def setUpClass(cls):
        cls.sample_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample"))
        cls.master_zip = os.path.join(cls.sample_dir, "fin_zvit_2025_sample.zip")

    # --------------------------------------------------------------------------
    # 1. ТЕСТУВАННЯ СКАНОРА ТА РОЗПІЗНАВАННЯ НАЗВ ФАЙЛІВ
    # --------------------------------------------------------------------------
    def test_scanner_parse_filename_kormotech(self):
        filename = "32673400_460140032673400S010011510000006122025.XML_2026-06-05 16:47:46.xml"
        res = ReportScanner.parse_filename(filename)
        self.assertIsNotNone(res)
        edrpou, form_code, ts = res
        self.assertEqual(edrpou, "32673400")
        self.assertEqual(form_code, "S0100115")
        self.assertEqual(ts, "2026-06-05 16:47:46")

    def test_scanner_parse_filename_nova_poshta(self):
        filename = "31316718_800010031316718S010335510000660122025.XML_2026-04-23 12:19:58.xml"
        res = ReportScanner.parse_filename(filename)
        self.assertIsNotNone(res)
        edrpou, form_code, ts = res
        self.assertEqual(edrpou, "31316718")
        self.assertEqual(form_code, "S0103355")
        self.assertEqual(ts, "2026-04-23 12:19:58")

    # --------------------------------------------------------------------------
    # 2. ТЕСТУВАННЯ ПАРСИНГУ ФОРМ КОРМОТЕХ (32673400)
    # --------------------------------------------------------------------------
    def test_parse_kormotech_f1_balance(self):
        file_path = os.path.join(self.sample_dir, "32673400_460140032673400S010011510000006122025.XML_2026-06-05 16:47:46.xml")
        parser = ParserRegistry.get_parser("S0100115")
        self.assertIsInstance(parser, ParserF1)

        with open(file_path, "rb") as f:
            result = parser.parse(f.read(), filename=os.path.basename(file_path), timestamp="2026-06-05 16:47:46")

        # Перевірка метаданих
        self.assertEqual(result["meta"]["form_code"], "S0100115")
        self.assertEqual(result["meta"]["period_year"], 2025)

        # Перевірка компанії
        company = result["company"]
        self.assertEqual(company["edrpou"], "32673400")
        self.assertIn("Кормотех", company["name"])
        self.assertEqual(company["kved"], "10.92")
        self.assertEqual(company["employees"], 999)
        self.assertEqual(company["accounting_standard"], "МСФЗ")

        # Перевірка фінансових рядків Балансу
        data = result["data"]
        self.assertIn("1300", data, "Рядок 1300 (Баланс активи) повинен бути в даних")
        self.assertEqual(data["1300"]["begin"], 2391091)
        self.assertEqual(data["1300"]["end"], 2718728)

        self.assertIn("1495", data, "Рядок 1495 (Власний капітал) повинен бути в даних")
        self.assertEqual(data["1495"]["end"], 1043641)

        self.assertIn("1165", data, "Рядок 1165 (Грошові кошти) повинен бути в даних")
        self.assertEqual(data["1165"]["begin"], 66978)
        self.assertEqual(data["1165"]["end"], 3254)

    def test_parse_kormotech_f2_income(self):
        file_path = os.path.join(self.sample_dir, "32673400_460140032673400S010021510000006122025.XML_2026-06-05 16:47:45.xml")
        parser = ParserRegistry.get_parser("S0100215")
        self.assertIsInstance(parser, ParserF2)

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        data = result["data"]
        # Виручка (рядок 2000)
        self.assertEqual(data["2000"]["current"], 6249313)
        self.assertEqual(data["2000"]["previous"], 5335858)

        # Чистий прибуток (рядок 2350)
        self.assertEqual(data["2350"]["current"], 91059)
        self.assertEqual(data["2350"]["previous"], 276687)

    def test_parse_kormotech_f3_cashflow_direct(self):
        file_path = os.path.join(self.sample_dir, "32673400_460140032673400S010031110000006122025.XML_2026-06-05 16:47:45.xml")
        parser = ParserRegistry.get_parser("S0100311")
        self.assertIsInstance(parser, ParserF3)

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        data = result["data"]
        # Рядок 3000 (Надходження від реалізації продукції)
        self.assertEqual(data["3000"]["current"], 7206237)
        self.assertEqual(data["3000"]["previous"], 6085832)

        # Рядок 3415 (Залишок коштів на кінець року)
        self.assertEqual(data["3415"]["current"], 3254)
        self.assertEqual(data["3415"]["previous"], 66978)

    # --------------------------------------------------------------------------
    # 3. ТЕСТУВАННЯ ПАРСИНГУ ФОРМ НОВА ПОШТА (31316718)
    # --------------------------------------------------------------------------
    def test_parse_nova_poshta_f1_balance(self):
        file_path = os.path.join(self.sample_dir, "31316718_800010031316718S010011510000658122025.XML_2026-04-23 12:19:52.xml")
        parser = ParserRegistry.get_parser("S0100115")

        with open(file_path, "rb") as f:
            result = parser.parse(f.read(), filename=os.path.basename(file_path))

        # Перевірка реквізитів
        company = result["company"]
        self.assertEqual(company["edrpou"], "31316718")
        self.assertIn("НОВА ПОШТА", company["name"])
        self.assertEqual(company["employees"], 27572)
        self.assertEqual(company["accounting_standard"], "МСФЗ")

        # Перевірка фінансових показників
        data = result["data"]
        # Активи (рядок 1300)
        self.assertEqual(data["1300"]["begin"], 31585793)
        self.assertEqual(data["1300"]["end"], 33824079)

        # Власний капітал (рядок 1495)
        self.assertEqual(data["1495"]["begin"], 11588379)
        self.assertEqual(data["1495"]["end"], 13362447)

        # Гроші (рядок 1165)
        self.assertEqual(data["1165"]["begin"], 2902009)
        self.assertEqual(data["1165"]["end"], 4195286)

    def test_parse_nova_poshta_f2_income(self):
        file_path = os.path.join(self.sample_dir, "31316718_800010031316718S010021510000659122025.XML_2026-04-23 12:19:53.xml")
        parser = ParserRegistry.get_parser("S0100215")

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        data = result["data"]
        # Виручка (рядок 2000)
        self.assertEqual(data["2000"]["current"], 54153003)
        self.assertEqual(data["2000"]["previous"], 44541772)

        # Чистий прибуток (рядок 2350)
        self.assertEqual(data["2350"]["current"], 2610370)
        self.assertEqual(data["2350"]["previous"], 2500331)

    def test_parse_nova_poshta_f3_cashflow_indirect(self):
        file_path = os.path.join(self.sample_dir, "31316718_800010031316718S010335510000660122025.XML_2026-04-23 12:19:58.xml")
        parser = ParserRegistry.get_parser("S0103355")
        self.assertIsInstance(parser, ParserF3Indirect)

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        self.assertEqual(result["meta"]["form_code"], "S0103355")
        data = result["data"]

        # Рядок 3195 (Чистий рух коштів від операційної діяльності)
        self.assertEqual(data["3195"]["current"], 8258854)
        self.assertEqual(data["3195"]["previous"], 5848251)

        # Рядок 3400 (Чистий рух грошових коштів за звітний період)
        self.assertEqual(data["3400"]["current"], 1281857)
        self.assertEqual(data["3400"]["previous"], 1797648)

        # Рядок 3405 (Залишок коштів на початок року)
        self.assertEqual(data["3405"]["current"], 2902009)
        self.assertEqual(data["3405"]["previous"], 1079267)

        # Рядок 3415 (Залишок коштів на кінець року)
        self.assertEqual(data["3415"]["current"], 4195286)
        self.assertEqual(data["3415"]["previous"], 2902009)

        # Перевірка збігу залишку коштів у Ф1 (Баланс) та Ф3-н (Рух коштів)
        self.assertEqual(data["3415"]["current"], 4195286)

    # --------------------------------------------------------------------------
    # 4. ТЕСТУВАННЯ ЄДИНОГО КОНСОЛІДОВАНОГО JSON ТА СТРІМІНГУ З АРХІВУ
    # --------------------------------------------------------------------------
    def test_parse_kormotech_f4_equity(self):
        file_path = os.path.join(self.sample_dir, "32673400_460140032673400S010401010000006122025.XML_2026-06-05 16:47:45.xml")
        parser = ParserRegistry.get_parser("S0104010")
        self.assertIsInstance(parser, ParserF4)

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        self.assertEqual(result["meta"]["form_code"], "S0104010")
        data = result["data"]

        # Рядок 4000 (Залишок на початок року): статутний 9 000, нерозподілений прибуток 1 348 544, разом 1 357 699
        self.assertEqual(data["4000"]["col_3"], 9000)
        self.assertEqual(data["4000"]["col_7"], 1348544)
        self.assertEqual(data["4000"]["col_10"], 1357699)

        # Рядок 4100 (Чистий прибуток): 91 058 тис. ₴
        self.assertEqual(data["4100"]["col_10"], 91058)

        # Рядок 4200 (Виплати власникам / дивіденди): -405 000 тис. ₴
        self.assertEqual(data["4200"]["col_10"], -405000)

        # Рядок 4300 (Залишок на кінець року): 1 043 641 тис. ₴
        self.assertEqual(data["4300"]["col_3"], 9000)
        self.assertEqual(data["4300"]["col_10"], 1043641)

    def test_parse_kormotech_f5_notes(self):
        file_path = os.path.join(self.sample_dir, "32673400_460140032673400S010500910000007122025.XML_2026-06-05 16:47:46.xml")
        parser = ParserRegistry.get_parser("S0105009")

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        self.assertEqual(result["meta"]["form_code"], "S0105009")
        data = result["data"]
        self.assertGreater(len(data), 100, "Ф5 Кормотех має містити понад 100 показників")

        # Розділ II. Основні засоби (рядок 260): первісна вартість A26=958 627, кінець L26=993 652
        self.assertEqual(data.get("A26"), 958627)
        self.assertEqual(data.get("L26"), 993652)
        # Знос: початок B26=339 559, кінець M26=414 506
        self.assertEqual(data.get("B26"), 339559)
        self.assertEqual(data.get("M26"), 414506)

    def test_parse_nova_poshta_f4_equity(self):
        file_path = os.path.join(self.sample_dir, "31316718_800010031316718S010401010000661122025.XML_2026-04-23 12:19:58.xml")
        parser = ParserRegistry.get_parser("S0104010")

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        self.assertEqual(result["meta"]["form_code"], "S0104010")
        data = result["data"]

        # Рядок 4000 (Залишок на початок року): статутний 4 654, разом 11 588 379
        self.assertEqual(data["4000"]["col_3"], 4654)
        self.assertEqual(data["4000"]["col_10"], 11588379)

        # Рядок 4100 (Чистий прибуток): 2 610 370 тис. ₴
        self.assertEqual(data["4100"]["col_10"], 2610370)

        # Рядок 4300 (Залишок на кінець року): 13 362 447 тис. ₴
        self.assertEqual(data["4300"]["col_3"], 4654)
        self.assertEqual(data["4300"]["col_10"], 13362447)

    def test_parse_nova_poshta_f5_notes(self):
        file_path = os.path.join(self.sample_dir, "31316718_800010031316718S010500910000662122025.XML_2026-04-23 12:19:54.xml")
        parser = ParserRegistry.get_parser("S0105009")

        with open(file_path, "rb") as f:
            result = parser.parse(f.read())

        self.assertEqual(result["meta"]["form_code"], "S0105009")
        data = result["data"]
        self.assertGreater(len(data), 400, "Ф5 Нова Пошта має містити понад 400 показників")

        # Розділ II. Основні засоби (рядок 260): первісна вартість A26=20 300 793, кінець L26=25 076 971
        self.assertEqual(data.get("A26"), 20300793)
        self.assertEqual(data.get("L26"), 25076971)
        # Знос: початок B26=6 031 694, кінець M26=8 776 554
        self.assertEqual(data.get("B26"), 6031694)
        self.assertEqual(data.get("M26"), 8776554)

    # --------------------------------------------------------------------------
    # 5. БАЛАНСОВІ РІВНЯННЯ ТА МІЖФОРМЕНА ЗВІРКА (RECONCILIATION)
    # --------------------------------------------------------------------------
    def test_accounting_balance_equations_kormotech(self):
        with open(os.path.join(self.sample_dir, "32673400_460140032673400S010011510000006122025.XML_2026-06-05 16:47:46.xml"), "rb") as f:
            f1 = ParserRegistry.get_parser("S0100115").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "32673400_460140032673400S010021510000006122025.XML_2026-06-05 16:47:45.xml"), "rb") as f:
            f2 = ParserRegistry.get_parser("S0100215").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "32673400_460140032673400S010031110000006122025.XML_2026-06-05 16:47:45.xml"), "rb") as f:
            f3 = ParserRegistry.get_parser("S0100311").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "32673400_460140032673400S010401010000006122025.XML_2026-06-05 16:47:45.xml"), "rb") as f:
            f4 = ParserRegistry.get_parser("S0104010").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "32673400_460140032673400S010500910000007122025.XML_2026-06-05 16:47:46.xml"), "rb") as f:
            f5 = ParserRegistry.get_parser("S0105009").parse(f.read())["data"]

        # 1. Основне балансове рівняння: Активи (1300) = Пасиви (1900)
        self.assertEqual(f1["1300"]["begin"], f1["1900"]["begin"])
        self.assertEqual(f1["1300"]["end"], f1["1900"]["end"])

        # 2. Рівняння капіталу: Активи (1300) = Власний капітал (1495) + Зобов'язання (1595 + 1695)
        calc_end = f1["1495"]["end"] + f1["1595"]["end"] + f1["1695"]["end"]
        self.assertEqual(f1["1300"]["end"], calc_end)

        # 3. Міжформена звірка грошей: Ф1 (1165) == Ф3 (3405 початок, 3415 кінець)
        self.assertEqual(f1["1165"]["begin"], f3["3405"]["current"])
        self.assertEqual(f1["1165"]["end"], f3["3415"]["current"])

        # 4. Міжформена звірка власного капіталу: Ф1 (1495) == Ф4 (4000 початок, 4300 кінець)
        self.assertEqual(f1["1495"]["begin"], f4["4000"]["col_10"])
        self.assertEqual(f1["1495"]["end"], f4["4300"]["col_10"])

        # 5. Міжформена звірка основних засобів: Ф1 (1011 первісна, 1012 знос) == Ф5 (A26/L26 та B26/M26)
        self.assertEqual(f1["1011"]["begin"], f5["A26"])
        self.assertEqual(f1["1011"]["end"], f5["L26"])
        self.assertEqual(f1["1012"]["begin"], f5["B26"])
        self.assertEqual(f1["1012"]["end"], f5["M26"])

    def test_accounting_balance_equations_nova_poshta(self):
        with open(os.path.join(self.sample_dir, "31316718_800010031316718S010011510000658122025.XML_2026-04-23 12:19:52.xml"), "rb") as f:
            f1 = ParserRegistry.get_parser("S0100115").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "31316718_800010031316718S010021510000659122025.XML_2026-04-23 12:19:53.xml"), "rb") as f:
            f2 = ParserRegistry.get_parser("S0100215").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "31316718_800010031316718S010335510000660122025.XML_2026-04-23 12:19:58.xml"), "rb") as f:
            f3 = ParserRegistry.get_parser("S0103355").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "31316718_800010031316718S010401010000661122025.XML_2026-04-23 12:19:58.xml"), "rb") as f:
            f4 = ParserRegistry.get_parser("S0104010").parse(f.read())["data"]
        with open(os.path.join(self.sample_dir, "31316718_800010031316718S010500910000662122025.XML_2026-04-23 12:19:54.xml"), "rb") as f:
            f5 = ParserRegistry.get_parser("S0105009").parse(f.read())["data"]

        # 1. Балансове рівняння: Активи = Пасиви
        self.assertEqual(f1["1300"]["begin"], f1["1900"]["begin"])
        self.assertEqual(f1["1300"]["end"], f1["1900"]["end"])

        # 2. Рівняння капіталу: Активи = Власний капітал + Довгострокові + Поточні зобов'язання
        calc_end = f1["1495"]["end"] + f1["1595"]["end"] + f1["1695"]["end"]
        self.assertEqual(f1["1300"]["end"], calc_end)

        # 3. Міжформена звірка грошей: Ф1 (1165) == Ф3-н (3405 початок, 3415 кінець)
        self.assertEqual(f1["1165"]["begin"], f3["3405"]["current"])
        self.assertEqual(f1["1165"]["end"], f3["3415"]["current"])

        # 4. Міжформена звірка власного капіталу: Ф1 (1495) == Ф4 (4000 початок, 4300 кінець)
        self.assertEqual(f1["1495"]["begin"], f4["4000"]["col_10"])
        self.assertEqual(f1["1495"]["end"], f4["4300"]["col_10"])

        # 5. Міжформена звірка прибутку: Ф2 (2350) == Ф4 (4100 col_10)
        self.assertEqual(f2["2350"]["current"], f4["4100"]["col_10"])

        # 6. Міжформена звірка основних засобів: Ф1 (1011/1012) == Ф5 (A26/L26 та B26/M26)
        self.assertEqual(f1["1011"]["begin"], f5["A26"])
        self.assertEqual(f1["1011"]["end"], f5["L26"])
        self.assertEqual(f1["1012"]["begin"], f5["B26"])
        self.assertEqual(f1["1012"]["end"], f5["M26"])

    # --------------------------------------------------------------------------
    # 6. ТЕСТУВАННЯ ЄДИНОГО КОНСОЛІДОВАНОГО JSON ТА СТРІМІНГУ З АРХІВУ
    # --------------------------------------------------------------------------
    def test_build_unified_company_json(self):
        comp_info = {"edrpou": "32673400", "name": "ТзОВ \"Кормотех\"", "kved": "10.92"}
        forms = [
            {"code": "S0100215", "title": "Ф2"},
            {"code": "S0100115", "title": "Ф1"}
        ]
        reports = {
            "S0100115": {"meta": {"form_code": "S0100115"}, "data": {}},
            "S0100215": {"meta": {"form_code": "S0100215"}, "data": {}}
        }

        unified = CompanyMetaBuilder.build_unified_company_json(
            company_info=comp_info,
            available_forms=forms,
            reports=reports,
            year=2025
        )

        self.assertEqual(unified["edrpou"], "32673400")
        self.assertEqual(unified["year"], 2025)
        # Форми мають бути відсортовані (Ф1 перед Ф2)
        self.assertEqual(unified["available_forms"][0]["code"], "S0100115")
        self.assertEqual(unified["available_forms"][1]["code"], "S0100215")
        self.assertIn("S0100115", unified["reports"])
        self.assertIn("S0100215", unified["reports"])

    def test_process_zip_master_discovers_both_companies(self):
        self.assertTrue(os.path.isfile(self.master_zip), f"Файл {self.master_zip} повинен існувати")
        
        company_demographics = {}
        from collections import defaultdict
        company_reports = defaultdict(dict)
        company_form_items = defaultdict(list)
        company_last_ts = defaultdict(str)

        total_forms = _process_zip_master(
            master_zip_path=self.master_zip,
            company_demographics=company_demographics,
            company_reports=company_reports,
            company_form_items=company_form_items,
            company_last_ts=company_last_ts
        )

        self.assertEqual(len(company_demographics), 2, "Архів повинен містити рівно 2 компанії")
        self.assertIn("32673400", company_demographics)
        self.assertIn("31316718", company_demographics)
        self.assertEqual(total_forms, 10, "Архів повинен містити 10 звітів (по 5 для кожної компанії)")
        self.assertEqual(len(company_reports["32673400"]), 5)
        self.assertEqual(len(company_reports["31316718"]), 5)

if __name__ == "__main__":
    unittest.main()
