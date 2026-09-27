"""
Тести для всіх модульних парсерів форм фінансової звітності:
- ParserF1 (S0100115: Баланс)
- ParserF2 (S0100215: Звіт про фінансові результати)
- ParserF3 (S0100311: Звіт про рух коштів, прямий метод)
- ParserF3Indirect (S0103355: Звіт про рух коштів, непрямий метод)
- ParserF4 (S0104010: Звіт про власний капітал)
- ParserF1F2M (S0110014: Звіт малого підприємства 1-м, 2-м)
- ParserF1F2MS (S0111007: Звіт мікропідприємства 1-мс, 2-мс)
- ParserGeneric (S0105009: Примітки до річної звітності, S0106007: Сегменти, та невідомі форми)
- ParserRegistry: Перевірка фабрики парсерів та префіксного мапінгу
"""

import unittest
from worker.parsers.parser_f1 import ParserF1
from worker.parsers.parser_f2 import ParserF2
from worker.parsers.parser_f3 import ParserF3, ParserF3Indirect
from worker.parsers.parser_f4 import ParserF4
from worker.parsers.parser_f1_f2_m import ParserF1F2M
from worker.parsers.parser_f1_f2_ms import ParserF1F2MS
from worker.parsers.parser_generic import ParserGeneric
from worker.parsers.parser_registry import ParserRegistry


class TestFormParsers(unittest.TestCase):

    def test_parser_f1_structure(self):
        """Тест ParserF1: розбір колонок 'begin' (A) та 'end' (B)."""
        xml = (
            b'<DECLAR>'
            b'  <DECLARHEAD><TIN>10000001</TIN><PERIOD_YEAR>2025</PERIOD_YEAR></DECLARHEAD>'
            b'  <DECLARBODY>'
            b'    <A1000>100</A1000><B1000>150</B1000>'
            b'    <A1010>500</A1010><B1010>600</B1010>'
            b'    <A1300>900</A1300>'  # Лише begin
            b'    <B1400>750</B1400>'  # Лише end
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        parser = ParserF1()
        self.assertEqual(parser.form_code, "S0100115")
        self.assertEqual(parser.form_name, "Ф1. Баланс")

        res = parser.parse(xml)
        data = res["data"]
        self.assertEqual(data["1000"], {"begin": 100, "end": 150})
        self.assertEqual(data["1010"], {"begin": 500, "end": 600})
        self.assertEqual(data["1300"], {"begin": 900, "end": None})
        self.assertEqual(data["1400"], {"begin": None, "end": 750})

    def test_parser_f2_structure(self):
        """Тест ParserF2: розбір колонок 'current' (A) та 'previous' (B)."""
        xml = (
            b'<DECLAR>'
            b'  <DECLARHEAD><TIN>10000002</TIN></DECLARHEAD>'
            b'  <DECLARBODY>'
            b'    <A2000>50000</A2000><B2000>42000</B2000>'
            b'    <A2350>4500</A2350><B2350>3800</B2350>'
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        parser = ParserF2()
        self.assertEqual(parser.form_code, "S0100215")
        self.assertEqual(parser.form_name, "Ф2. Звіт про фінансові результати")

        res = parser.parse(xml)
        data = res["data"]
        self.assertEqual(data["2000"], {"current": 50000, "previous": 42000})
        self.assertEqual(data["2350"], {"current": 4500, "previous": 3800})

    def test_parser_f3_direct_structure(self):
        """Тест ParserF3 (прямий метод): розбір A{код}_3 (current) та A{код}_4 (previous)."""
        xml = (
            b'<DECLAR>'
            b'  <DECLARHEAD><TIN>10000003</TIN></DECLARHEAD>'
            b'  <DECLARBODY>'
            b'    <A3000_3>7206237</A3000_3><A3000_4>6085832</A3000_4>'
            b'    <A3195_3>164648</A3195_3><A3195_4>308387</A3195_4>'
            b'    <A3415_3>3254</A3415_3><A3415_4>66978</A3415_4>'
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        parser = ParserF3()
        self.assertEqual(parser.form_code, "S0100311")
        self.assertEqual(parser.form_name, "Ф3. Звіт про рух грошових коштів")

        res = parser.parse(xml)
        data = res["data"]
        self.assertEqual(data["3000"], {"current": 7206237, "previous": 6085832})
        self.assertEqual(data["3195"], {"current": 164648, "previous": 308387})
        self.assertEqual(data["3415"], {"current": 3254, "previous": 66978})

    def test_parser_f3_indirect_structure(self):
        """Тест ParserF3Indirect (непрямий метод): розбір 4 граф (_3 надходження, _4 вибуття, _5, _6)."""
        xml = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>10000004</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <!-- Чистий рух від операційної діяльності (ряд. 3195): поточний прибуток 8258854 (гр 3), попередній 5848251 (гр 5) -->'
            '    <A3195_3>8258854</A3195_3><A3195_5>5848251</A3195_5>'
            '    <!-- Чистий рух від інвестиційної діяльності (ряд. 3295): відтік 1148247 (гр 4), попередній відтік 1324784 (гр 6) -->'
            '    <A3295_4>1148247</A3295_4><A3295_6>1324784</A3295_6>'
            '    <!-- Рядок з одночасним надходженням і видатком: current = 1000 - 400 = 600 -->'
            '    <A3050_3>1000</A3050_3><A3050_4>400</A3050_4>'
            '  </DECLARBODY>'
            '</DECLAR>'
        ).encode('utf-8')
        parser = ParserF3Indirect()
        self.assertEqual(parser.form_code, "S0103355")
        self.assertIn("непрямим", parser.form_name)

        res = parser.parse(xml)
        data = res["data"]

        # Рядок 3195
        self.assertEqual(data["3195"]["current"], 8258854)
        self.assertEqual(data["3195"]["previous"], 5848251)
        self.assertEqual(data["3195"]["inflow_current"], 8258854)
        self.assertIsNone(data["3195"]["outflow_current"])

        # Рядок 3295 (чистий вибуток зберігається у полі current, а також деталізовано)
        self.assertEqual(data["3295"]["current"], 1148247)
        self.assertEqual(data["3295"]["outflow_current"], 1148247)
        self.assertEqual(data["3295"]["outflow_previous"], 1324784)

        # Рядок 3050 (взаємне сальдування 1000 - 400)
        self.assertEqual(data["3050"]["current"], 600)
        self.assertEqual(data["3050"]["inflow_current"], 1000)
        self.assertEqual(data["3050"]["outflow_current"], 400)

    def test_parser_f4_equity_structure(self):
        """Тест ParserF4: розбір A{код}_{колонка} для колонок з 3 по 10."""
        xml = (
            b'<DECLAR>'
            b'  <DECLARHEAD><TIN>10000005</TIN></DECLARHEAD>'
            b'  <DECLARBODY>'
            b'    <A4000_3>9000</A4000_3>'      # Статутний капітал на початок
            b'    <A4000_7>1200000</A4000_7>'   # Нерозподілений прибуток
            b'    <A4000_10>1357699</A4000_10>' # Разом власний капітал
            b'    <A4300_3>9000</A4300_3>'      # Статутний на кінець
            b'    <A4300_10>1043641</A4300_10>' # Разом на кінець
            b'  </DECLARBODY>'
            b'</DECLAR>'
        )
        parser = ParserF4()
        self.assertEqual(parser.form_code, "S0104010")
        self.assertEqual(parser.form_name, "Ф4. Звіт про власний капітал")

        res = parser.parse(xml)
        data = res["data"]
        self.assertEqual(data["4000"]["col_3"], 9000)
        self.assertEqual(data["4000"]["col_7"], 1200000)
        self.assertEqual(data["4000"]["col_10"], 1357699)
        self.assertEqual(data["4300"]["col_3"], 9000)
        self.assertEqual(data["4300"]["col_10"], 1043641)

    def test_parser_f1_f2_m_small_business(self):
        """Тест ParserF1F2M (S0110014): об'єднана форма 1-м та 2-м."""
        xml = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>10000006</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <!-- Баланс: A{код}_3 (початок), A{код}_4 (кінець) -->'
            '    <A1010_3>50</A1010_3><A1010_4>60</A1010_4>'
            '    <A1300_3>200</A1300_3><A1300_4>250</A1300_4>'
            '    <!-- Фінрезультати: B{код}_3 (звітний), B{код}_4 (попередній) -->'
            '    <B2000_3>1500</B2000_3><B2000_4>1200</B2000_4>'
            '    <B2350_3>180</B2350_3><B2350_4>140</B2350_4>'
            '  </DECLARBODY>'
            '</DECLAR>'
        ).encode('utf-8')
        parser = ParserF1F2M()
        self.assertEqual(parser.form_code, "S0110014")

        res = parser.parse(xml)
        data = res["data"]
        self.assertIn("balance", data)
        self.assertIn("income", data)

        self.assertEqual(data["balance"]["1010"], {"begin": 50, "end": 60})
        self.assertEqual(data["balance"]["1300"], {"begin": 200, "end": 250})
        self.assertEqual(data["income"]["2000"], {"current": 1500, "previous": 1200})
        self.assertEqual(data["income"]["2350"], {"current": 180, "previous": 140})

    def test_parser_f1_f2_ms_micro_business(self):
        """Тест ParserF1F2MS (S0111007): мікропідприємства 1-мс, 2-мс."""
        xml = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>10000007</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <A1095_3>10</A1095_3><A1095_4>15</A1095_4>'
            '    <B2000_3>300</B2000_3><B2000_4>250</B2000_4>'
            '  </DECLARBODY>'
            '</DECLAR>'
        ).encode('utf-8')
        parser = ParserF1F2MS()
        self.assertEqual(parser.form_code, "S0111007")

        res = parser.parse(xml)
        data = res["data"]
        self.assertEqual(data["balance"]["1095"], {"begin": 10, "end": 15})
        self.assertEqual(data["income"]["2000"], {"current": 300, "previous": 250})

    def test_parser_generic_notes_and_custom(self):
        """Тест ParserGeneric: ігнорує службові теги підприємства та зберігає числові й текстові показники."""
        xml = (
            '<DECLAR>'
            '  <DECLARHEAD><TIN>10000008</TIN></DECLARHEAD>'
            '  <DECLARBODY>'
            '    <!-- Службові теги реквізитів, які мають бути відфільтровані -->'
            '    <FIRM_NAME>ТОВ "ТЕСТ"</FIRM_NAME>'
            '    <FIRM_EDRPOU>10000008</FIRM_EDRPOU>'
            '    <FIRM_RUK>Іванов І.І.</FIRM_RUK>'
            '    <!-- Показники форми 5 -->'
            '    <A07>3596</A07>'
            '    <A12>243862</A12>'
            '    <A1300>99929.50</A1300>'
            '    <TEXT_NOTE>Аудиторський висновок без застережень</TEXT_NOTE>'
            '  </DECLARBODY>'
            '</DECLAR>'
        ).encode('utf-8')
        parser = ParserGeneric("S0105009", "Ф5. Примітки до річної звітності")
        res = parser.parse(xml)
        data = res["data"]

        # Службові теги компанії не потрапляють у фінансові показники
        self.assertNotIn("FIRM_NAME", data)
        self.assertNotIn("FIRM_EDRPOU", data)
        self.assertNotIn("FIRM_RUK", data)

        # Числові та текстові рядки форми
        self.assertEqual(data["A07"], 3596)
        self.assertEqual(data["A12"], 243862)
        self.assertEqual(data["A1300"], 99929.5)
        self.assertEqual(data["TEXT_NOTE"], "Аудиторський висновок без застережень")

    def test_parser_registry_resolution(self):
        """Тест ParserRegistry: коректне повернення спеціалізованих парсерів за префіксами."""
        self.assertIsInstance(ParserRegistry.get_parser("S0100115"), ParserF1)
        self.assertIsInstance(ParserRegistry.get_parser("S0100114"), ParserF1)  # За префіксом S01001
        self.assertIsInstance(ParserRegistry.get_parser("S0100215"), ParserF2)
        self.assertIsInstance(ParserRegistry.get_parser("S0100311"), ParserF3)
        self.assertIsInstance(ParserRegistry.get_parser("S0103355"), ParserF3Indirect)
        self.assertIsInstance(ParserRegistry.get_parser("S0104010"), ParserF4)
        self.assertIsInstance(ParserRegistry.get_parser("S0110014"), ParserF1F2M)
        self.assertIsInstance(ParserRegistry.get_parser("S0111007"), ParserF1F2MS)

        # Ф5 Примітки та Ф6 Сегменти
        p_f5 = ParserRegistry.get_parser("S0105009")
        self.assertIsInstance(p_f5, ParserGeneric)
        self.assertEqual(p_f5.form_code, "S0105009")

        p_f6 = ParserRegistry.get_parser("S0106007")
        self.assertIsInstance(p_f6, ParserGeneric)
        self.assertEqual(p_f6.form_code, "S0106007")

        # Невідома довільна форма (fallback)
        p_unknown = ParserRegistry.get_parser("S9999999")
        self.assertIsInstance(p_unknown, ParserGeneric)
        self.assertEqual(p_unknown.form_code, "S9999999")


if __name__ == "__main__":
    unittest.main()
