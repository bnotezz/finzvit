"""
Тести для обробки крайніх випадків (edge cases) при парсингу XML:
- Битий / обірваний XML
- Порожній XML
- Наявність null-байтів та керівних символів
- Різні кодування (UTF-8, Windows-1251, UTF-8 з BOM)
- Відсутність <DECLARHEAD> або <DECLARBODY>
- Обробка xsi:nil="true"
- Формати чисел: коми, нерозривні пробіли, від'ємні значення у дужках або з мінусом в кінці
- Спеціальні символи та лапки в назвах підприємств
- Варіації ЄДРПОУ (8 та 10 знаків)
"""

import unittest
import xml.etree.ElementTree as ET
from worker.parsers.base_parser import BaseFormParser
from worker.parsers.parser_f1 import ParserF1
from worker.parsers.parser_f2 import ParserF2
from worker.parsers.parser_generic import ParserGeneric
from worker.scanner import ReportScanner


class TestXmlParsingEdgeCases(unittest.TestCase):

    def setUp(self):
        self.parser_f1 = ParserF1()
        self.parser_f2 = ParserF2()
        self.parser_generic = ParserGeneric("S0105009", "Ф5. Примітки")

    def test_empty_xml_raises_value_error(self):
        """Порожній XML або рядок лише з пробілами викликає ValueError."""
        with self.assertRaises(ValueError):
            self.parser_f1.parse(b"")

        with self.assertRaises(ValueError):
            self.parser_f1.parse(b"   \n\t  ")

    def test_corrupted_and_truncated_xml_raises_parse_error(self):
        """Некоректний або обірваний XML викликає ET.ParseError."""
        corrupted = b"<DECLAR><DECLARHEAD><TIN>12345678</TIN></DECLARHEAD><DECLARBODY><A1000>100"
        with self.assertRaises(ET.ParseError):
            self.parser_f1.parse(corrupted)

        invalid_syntax = b"<DECLAR><DECLARHEAD></wrong_close></DECLAR>"
        with self.assertRaises(ET.ParseError):
            self.parser_f1.parse(invalid_syntax)

    def test_null_bytes_in_xml_cleaned_successfully(self):
        """XML із випадковими null-байтами \x00 успішно очищається і парситься."""
        xml_with_nulls = (
            b'<?xml version="1.0" encoding="utf-8"?>\n'
            b'<DECLAR>\x00'
            b'  <DECLARHEAD>\x00'
            b'    <TIN>32673400</TIN>\x00'
            b'  </DECLARHEAD>\x00'
            b'  <DECLARBODY>\x00'
            b'    <FIRM_NAME>\x00\x00\xd0\xa2\xd0\x9e\xd0\x92 "\xd0\x9a\xd0\x9e\xd0\xa0\xd0\x9c\xd0\x9e\xd0\xa2\xd0\x95\xd0\xa5"</FIRM_NAME>\x00'
            b'    <A1000>1500</A1000>\x00'
            b'    <B1000>2000</B1000>\x00'
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        res = self.parser_f1.parse(xml_with_nulls)
        self.assertEqual(res["meta"]["tin"], "32673400")
        self.assertEqual(res["company"]["name"], 'ТОВ "КОРМОТЕХ"')
        self.assertEqual(res["data"]["1000"]["begin"], 1500)
        self.assertEqual(res["data"]["1000"]["end"], 2000)

    def test_encoding_cp1251_with_declaration(self):
        """XML у кодуванні Windows-1251 з оголошенням у заголовку коректно парситься."""
        xml_str = (
            '<?xml version="1.0" encoding="windows-1251"?>\n'
            '<DECLAR>'
            '  <DECLARHEAD><TIN>12345678</TIN><PERIOD_YEAR>2025</PERIOD_YEAR></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <FIRM_NAME>ТОВ "УКРАЇНСЬКІ ТРАДИЦІЇ &amp; СЕРВІС"</FIRM_NAME>'
            '    <A1010>500</A1010><B1010>800</B1010>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        raw_bytes = xml_str.encode("windows-1251")
        res = self.parser_f1.parse(raw_bytes)
        self.assertEqual(res["company"]["name"], 'ТОВ "УКРАЇНСЬКІ ТРАДИЦІЇ & СЕРВІС"')
        self.assertEqual(res["data"]["1010"]["begin"], 500)
        self.assertEqual(res["data"]["1010"]["end"], 800)

    def test_encoding_cp1251_without_declaration_fallback(self):
        """XML у кодуванні Windows-1251 БЕЗ заголовку <?xml ... encoding=...?> підхоплюється fallback-декодуванням."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>87654321</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <FIRM_NAME>ПП "ПІВДЕНЬ-ЗАХІД"</FIRM_NAME>'
            '    <A2000>1200</A2000><B2000>1400</B2000>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        raw_bytes = xml_str.encode("windows-1251")
        res = self.parser_f2.parse(raw_bytes)
        self.assertEqual(res["meta"]["tin"], "87654321")
        self.assertEqual(res["company"]["name"], 'ПП "ПІВДЕНЬ-ЗАХІД"')
        self.assertEqual(res["data"]["2000"]["current"], 1200)

    def test_encoding_utf8_with_bom(self):
        """XML у кодуванні UTF-8 із BOM (Byte Order Mark, \\xef\\xbb\\xbf) успішно парситься."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>11223344</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <FIRM_NAME>ТОВ "БЕТА-ТЕСТ"</FIRM_NAME>'
            '    <A1000>100</A1000>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        bom_bytes = b"\xef\xbb\xbf" + xml_str.encode("utf-8")
        res = self.parser_f1.parse(bom_bytes)
        self.assertEqual(res["meta"]["tin"], "11223344")
        self.assertEqual(res["company"]["name"], 'ТОВ "БЕТА-ТЕСТ"')
        self.assertEqual(res["data"]["1000"]["begin"], 100)

    def test_missing_declarhead_graceful_defaults(self):
        """XML без вузла <DECLARHEAD> повертає безпечні значення метаданих без збоїв."""
        xml_bytes = (
            b'<DECLAR>'
            b'  <DECLARBODY>'
            b'    <FIRM_EDRPOU>32673400</FIRM_EDRPOU>'
            b'    <A1010>123</A1010>'
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        res = self.parser_f1.parse(xml_bytes, filename="test.xml", timestamp="2026-01-01 10:00:00")
        self.assertEqual(res["meta"]["filename"], "test.xml")
        self.assertEqual(res["meta"]["period_year"], 2025)
        self.assertIsNone(res["meta"]["tin"])
        self.assertEqual(res["company"]["edrpou"], "32673400")
        self.assertEqual(res["data"]["1010"]["begin"], 123)

    def test_missing_declarbody_graceful_defaults(self):
        """XML без вузла <DECLARBODY> не падає і повертає порожні дані та профіль."""
        xml_bytes = (
            b'<DECLAR>'
            b'  <DECLARHEAD>'
            b'    <TIN>32673400</TIN>'
            b'    <PERIOD_YEAR>2025</PERIOD_YEAR>'
            b'  </DECLARHEAD>'
            b'</DECLAR>'
        )
        res = self.parser_f1.parse(xml_bytes)
        self.assertEqual(res["meta"]["tin"], "32673400")
        self.assertIsNone(res["company"]["name"])
        self.assertEqual(res["data"], {})

    def test_xsi_nil_handling(self):
        """Теги з атрибутом xsi:nil="true" ігноруються або дають None."""
        xml_bytes = (
            b'<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            b'  <DECLARBODY>'
            b'    <FIRM_NAME xsi:nil="true"/>'
            b'    <A1000 xsi:nil="true"/>'
            b'    <B1000>999</B1000>'
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        res = self.parser_f1.parse(xml_bytes)
        self.assertIsNone(res["company"]["name"])
        self.assertIsNone(res["data"]["1000"]["begin"])
        self.assertEqual(res["data"]["1000"]["end"], 999)

    def test_number_formatting_commas_and_spaces(self):
        """Обробка чисел з комами, пробілами, нерозривними пробілами (\\xa0) та вузькими пробілами (\\u202f)."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <A1000> 1 234,50 </A1000>'
            '    <B1000>1\xa0500\xa0000</B1000>'
            '    <A1010>2\u202f345,75</A1010>'
            '    <B1010>42.0</B1010>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res = self.parser_f1.parse(xml_str.encode("utf-8"))
        self.assertEqual(res["data"]["1000"]["begin"], 1234.5)
        self.assertEqual(res["data"]["1000"]["end"], 1500000)
        self.assertEqual(res["data"]["1010"]["begin"], 2345.75)
        self.assertEqual(res["data"]["1010"]["end"], 42)

    def test_accounting_negative_number_formats(self):
        """Бухгалтерські позначення від'ємних чисел: дужки (150), мінус в кінці 150-, звичайний мінус -150."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <A2000>(1500.50)</A2000>'
            '    <B2000>250-</B2000>'
            '    <A2050>-300</A2050>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res = self.parser_f2.parse(xml_str.encode("utf-8"))
        self.assertEqual(res["data"]["2000"]["current"], -1500.5)
        self.assertEqual(res["data"]["2000"]["previous"], -250)
        self.assertEqual(res["data"]["2050"]["current"], -300)

    def test_zero_versus_none_distinction(self):
        """Нульові значення ('0', '0.00') зберігаються як 0, а порожні теги як None."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <A1000>0</A1000>'
            '    <B1000>0.00</B1000>'
            '    <A1010></A1010>'
            '    <B1010>   </B1010>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res = self.parser_f1.parse(xml_str.encode("utf-8"))
        self.assertEqual(res["data"]["1000"]["begin"], 0)
        self.assertEqual(res["data"]["1000"]["end"], 0)
        # Рядок 1010 не повинен потрапити, оскільки обидва значення порожні
        self.assertNotIn("1010", res["data"])

    def test_special_characters_in_company_names(self):
        """XML-сутності в назвах (лапки, амперсанди, апострофи) коректно декодуються."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <FIRM_NAME>ТОВ &quot;М\'ЯСО-ІНВЕСТ &amp; КО&quot;</FIRM_NAME>'
            '    <A1000>10</A1000>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res = self.parser_f1.parse(xml_str.encode("utf-8"))
        self.assertEqual(res["company"]["name"], 'ТОВ "М\'ЯСО-ІНВЕСТ & КО"')

    def test_employee_and_accounting_standards(self):
        """Парсинг середньої кількості працівників (N3) та стандарту обліку (N4, N5)."""
        xml_str = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <N3> 27572 </N3>'
            '    <N4>0</N4>'
            '    <N5>1</N5>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res = self.parser_f1.parse(xml_str.encode("utf-8"))
        self.assertEqual(res["company"]["employees"], 27572)
        self.assertEqual(res["company"]["accounting_standard"], "МСФЗ")

        # Перевірка НП(С)БО
        xml_str_psbo = (
            '<DECLAR>'
            '  <DECLARBODY>'
            '    <N3>1400</N3>'
            '    <N4>1</N4>'
            '    <N5>0</N5>'
            '  </DECLARBODY>'
            '</DECLAR>'
        )
        res_psbo = self.parser_f1.parse(xml_str_psbo.encode("utf-8"))
        self.assertEqual(res_psbo["company"]["employees"], 1400)
        self.assertEqual(res_psbo["company"]["accounting_standard"], "НП(С)БО")

    def test_clean_edrpou_leading_zeros(self):
        """Очищення ЄДРПОУ від префіксних нулів при 10-значному форматі."""
        self.assertEqual(ReportScanner._clean_edrpou("00290771"), "00290771")  # 8 знаків зберігаються з ведучими нулями
        self.assertEqual(ReportScanner._clean_edrpou("0031316718"), "31316718")  # 10 знаків з '00' зрізаються до 8 знаків
        self.assertEqual(ReportScanner._clean_edrpou("32673400"), "32673400")


if __name__ == "__main__":
    unittest.main()
