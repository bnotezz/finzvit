import os
import sys
import unittest
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from worker.financial_calc import FinancialCalculator

class TestFinancialIndicators(unittest.TestCase):
    """
    Тести розрахунку 7 основних фінансових показників та 9 фінансових коефіцієнтів
    для ТзОВ "Кормотех" (32673400) та ТОВ "Нова Пошта" (31316718).
    """

    @classmethod
    def setUpClass(cls):
        cls.data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public", "data", "2025"))
        
        with open(os.path.join(cls.data_dir, "32673400.json"), "r", encoding="utf-8") as f:
            cls.kormotech = json.load(f)
            
        with open(os.path.join(cls.data_dir, "31316718.json"), "r", encoding="utf-8") as f:
            cls.nova_poshta = json.load(f)

    # --------------------------------------------------------------------------
    # 1. ТЕСТУВАННЯ ОСНОВНИХ ПОКАЗНИКІВ КОРМОТЕХ
    # --------------------------------------------------------------------------
    def test_kormotech_main_metrics(self):
        kpi = FinancialCalculator.calculate_company_kpis(self.kormotech)
        mm = kpi["main_metrics"]

        # Виручка (рядок 2000): 6,249,313 тис. ₴ (+17.1%)
        self.assertEqual(mm["revenue"]["current"], 6249313)
        self.assertEqual(mm["revenue"]["previous"], 5335858)
        self.assertAlmostEqual(mm["revenue"]["change_pct"], 17.119, places=2)

        # Чистий прибуток (рядок 2350): 91,059 тис. ₴
        self.assertEqual(mm["net_income"]["current"], 91059)
        self.assertEqual(mm["net_income"]["previous"], 276687)
        self.assertAlmostEqual(mm["net_income"]["change_pct"], -67.089, places=2)

        # Активи (рядок 1300): 2,718,728 тис. ₴ (+13.7%)
        self.assertEqual(mm["assets"]["current"], 2718728)
        self.assertEqual(mm["assets"]["previous"], 2391091)
        self.assertAlmostEqual(mm["assets"]["change_pct"], 13.702, places=2)

        # Власний капітал (рядок 1495): 1,043,641 тис. ₴
        self.assertEqual(mm["equity"]["current"], 1043641)
        self.assertEqual(mm["equity"]["previous"], 1357699)
        self.assertAlmostEqual(mm["equity"]["change_pct"], -23.131, places=2)

        # Гроші (рядок 1165): 3,254 тис. ₴
        self.assertEqual(mm["cash"]["current"], 3254)
        self.assertEqual(mm["cash"]["previous"], 66978)

        # Довгострокові зобов'язання (рядок 1595): 59,731 тис. ₴
        self.assertEqual(mm["lt_debt"]["current"], 59731)

        # Поточні зобов'язання (рядок 1695): 1,615,356 тис. ₴
        self.assertEqual(mm["st_debt"]["current"], 1615356)

    # --------------------------------------------------------------------------
    # 2. ТЕСТУВАННЯ ФІНАНСОВИХ КОЕФІЦІЄНТІВ КОРМОТЕХ
    # --------------------------------------------------------------------------
    def test_kormotech_financial_ratios(self):
        kpi = FinancialCalculator.calculate_company_kpis(self.kormotech)
        r = kpi["ratios"]

        # 1. Поточна ліквідність (1195 / 1695) = 1,997,296 / 1,615,356 ≈ 1.24
        self.assertAlmostEqual(r["current_ratio"]["value"], 1.236, places=2)

        # 2. Абсолютна ліквідність ((1160 + 1165) / 1695) = 3,254 / 1,615,356 ≈ 0.002
        self.assertAlmostEqual(r["absolute_ratio"]["value"], 0.002, places=3)

        # 3. Швидка ліквідність ((1195 - 1100) / 1695) = (1,997,296 - 805,604) / 1,615,356 ≈ 0.74
        self.assertAlmostEqual(r["quick_ratio"]["value"], 0.738, places=2)

        # 4. Коефіцієнт автономії (1495 / 1900) = 1,043,641 / 2,718,728 ≈ 0.38
        self.assertAlmostEqual(r["autonomy_ratio"]["value"], 0.384, places=2)

        # 5. ROA ((2350 / 1900) * 100) = (91,059 / 2,718,728) * 100 ≈ 3.35%
        self.assertAlmostEqual(r["roa"]["value"], 3.349, places=2)

        # 6. ROE ((2350 / 1495) * 100) = (91,059 / 1,043,641) * 100 ≈ 8.73%
        self.assertAlmostEqual(r["roe"]["value"], 8.725, places=2)

        # 7. Чиста маржа ((2350 / 2000) * 100) = (91,059 / 6,249,313) * 100 ≈ 1.46%
        self.assertAlmostEqual(r["net_margin"]["value"], 1.457, places=2)

        # 8. Покриття необоротних активів (1495 / 1095) = 1,043,641 / 721,432 ≈ 1.45
        self.assertAlmostEqual(r["cap_coverage"]["value"], 1.447, places=2)

        # 9. Коефіцієнт заборгованості (1695 / 1300) = 1,615,356 / 2,718,728 ≈ 0.59
        self.assertAlmostEqual(r["debt_ratio"]["value"], 0.594, places=2)

        # 10. Забезпеченість власними оборотними коштами ((1195 - 1695) / 1195) = 381,940 / 1,997,296 ≈ 0.191
        self.assertAlmostEqual(r["working_capital_ratio"]["value"], 0.191, places=2)

        # 11. Коефіцієнт придатності основних засобів (1010 / 1011) = 579,146 / 993,652 ≈ 0.583
        self.assertAlmostEqual(r["fixed_assets_condition"]["value"], 0.583, places=2)

        # 12. Коефіцієнт маневреності власного капіталу ((1195 - 1695) / 1495) = 381,940 / 1,043,641 ≈ 0.366
        self.assertAlmostEqual(r["equity_maneuverability"]["value"], 0.366, places=2)

        # 13. Фінансовий леверидж ((1595 + 1695) / 1495) = (59,731 + 1,615,356) / 1,043,641 ≈ 1.605
        self.assertAlmostEqual(r["financial_leverage"]["value"], 1.605, places=2)

        # 14. Валова маржа ((2000 - 2050) / 2000 * 100) = 1,541,766 / 6,249,313 * 100 ≈ 24.67%
        self.assertAlmostEqual(r["gross_margin"]["value"], 24.671, places=2)

        # 15. Рентабельність виробництва (1,541,766 / 4,707,547 * 100) ≈ 32.75%
        self.assertAlmostEqual(r["production_profitability"]["value"], 32.751, places=2)

        # 16. Оборотність дебіторки (6,249,313 / 803,970) ≈ 7.77 об. (46.96 дн.)
        self.assertAlmostEqual(r["receivables_turnover"]["value"], 7.773, places=2)
        self.assertAlmostEqual(r["receivables_days"]["value"], 46.958, places=1)

        # 17. Оборотність кредиторки (6,249,313 / 657,733) ≈ 9.50 об. (38.42 дн.)
        self.assertAlmostEqual(r["payables_turnover"]["value"], 9.501, places=2)
        self.assertAlmostEqual(r["payables_days"]["value"], 38.416, places=1)

        # 18. Фондовіддача (6,249,313 / 579,146) ≈ 10.79
        self.assertAlmostEqual(r["fixed_asset_turnover"]["value"], 10.79, places=1)

        # 19. Покриття виробничих витрат (4,707,547 / 6,249,313 * 100) ≈ 75.33%
        self.assertAlmostEqual(r["cost_coverage"]["value"], 75.329, places=2)

        # 20. Продуктивність праці (6,249,313 / 999 працівників) ≈ 6,255.57 тис. ₴
        self.assertAlmostEqual(r["revenue_per_employee"]["value"], 6255.568, places=1)

        # 21. Прибутковість персоналу (91,059 / 999 працівників) ≈ 91.15 тис. ₴
        self.assertAlmostEqual(r["profit_per_employee"]["value"], 91.15, places=1)

    # --------------------------------------------------------------------------
    # 3. ТЕСТУВАННЯ ОСНОВНИХ ПОКАЗНИКІВ НОВА ПОШТА
    # --------------------------------------------------------------------------
    def test_nova_poshta_main_metrics(self):
        kpi = FinancialCalculator.calculate_company_kpis(self.nova_poshta)
        mm = kpi["main_metrics"]

        # Виручка: 54,153,003 тис. ₴ (+21.6%)
        self.assertEqual(mm["revenue"]["current"], 54153003)
        self.assertEqual(mm["revenue"]["previous"], 44541772)
        self.assertAlmostEqual(mm["revenue"]["change_pct"], 21.578, places=2)

        # Чистий прибуток: 2,610,370 тис. ₴ (+4.4%)
        self.assertEqual(mm["net_income"]["current"], 2610370)
        self.assertEqual(mm["net_income"]["previous"], 2500331)
        self.assertAlmostEqual(mm["net_income"]["change_pct"], 4.401, places=2)

        # Активи: 33,824,079 тис. ₴ (+7.1%)
        self.assertEqual(mm["assets"]["current"], 33824079)
        self.assertEqual(mm["assets"]["previous"], 31585793)
        self.assertAlmostEqual(mm["assets"]["change_pct"], 7.086, places=2)

        # Власний капітал: 13,362,447 тис. ₴ (+15.3%)
        self.assertEqual(mm["equity"]["current"], 13362447)
        self.assertEqual(mm["equity"]["previous"], 11588379)
        self.assertAlmostEqual(mm["equity"]["change_pct"], 15.309, places=2)

        # Гроші: 4,195,286 тис. ₴ (+44.6%)
        self.assertEqual(mm["cash"]["current"], 4195286)
        self.assertEqual(mm["cash"]["previous"], 2902009)
        self.assertAlmostEqual(mm["cash"]["change_pct"], 44.565, places=2)

        # Довгострокові зобов'язання: 8,609,883 тис. ₴
        self.assertEqual(mm["lt_debt"]["current"], 8609883)

        # Поточні зобов'язання: 11,851,749 тис. ₴
        self.assertEqual(mm["st_debt"]["current"], 11851749)

    # --------------------------------------------------------------------------
    # 4. ТЕСТУВАННЯ ФІНАНСОВИХ КОЕФІЦІЄНТІВ НОВА ПОШТА
    # --------------------------------------------------------------------------
    def test_nova_poshta_financial_ratios(self):
        kpi = FinancialCalculator.calculate_company_kpis(self.nova_poshta)
        r = kpi["ratios"]

        # 1. Поточна ліквідність (1195 / 1695) = 8,176,640 / 11,851,749 ≈ 0.69
        self.assertAlmostEqual(r["current_ratio"]["value"], 0.690, places=2)

        # 2. Абсолютна ліквідність ((1160 + 1165) / 1695) = (299,724 + 4,195,286) / 11,851,749 ≈ 0.38
        self.assertAlmostEqual(r["absolute_ratio"]["value"], 0.379, places=2)

        # 3. Швидка ліквідність ((1195 - 1100) / 1695) = (8,176,640 - 473,387) / 11,851,749 ≈ 0.65
        self.assertAlmostEqual(r["quick_ratio"]["value"], 0.650, places=2)

        # 4. Коефіцієнт автономії (1495 / 1900) = 13,362,447 / 33,824,079 ≈ 0.40
        self.assertAlmostEqual(r["autonomy_ratio"]["value"], 0.395, places=2)

        # 5. ROA ((2350 / 1900) * 100) = (2,610,370 / 33,824,079) * 100 ≈ 7.72%
        self.assertAlmostEqual(r["roa"]["value"], 7.717, places=2)

        # 6. ROE ((2350 / 1495) * 100) = (2,610,370 / 13,362,447) * 100 ≈ 19.54%
        self.assertAlmostEqual(r["roe"]["value"], 19.535, places=2)

        # 7. Чиста маржа ((2350 / 2000) * 100) = (2,610,370 / 54,153,003) * 100 ≈ 4.82%
        self.assertAlmostEqual(r["net_margin"]["value"], 4.820, places=2)

        # 8. Покриття необоротних активів (1495 / 1095) = 13,362,447 / 25,647,439 ≈ 0.52
        self.assertAlmostEqual(r["cap_coverage"]["value"], 0.521, places=2)

        # 9. Коефіцієнт заборгованості (1695 / 1300) = 11,851,749 / 33,824,079 ≈ 0.35
        self.assertAlmostEqual(r["debt_ratio"]["value"], 0.350, places=2)

    # --------------------------------------------------------------------------
    # 5. ТЕСТУВАННЯ ГРАНИЧНИХ ВИПАДКІВ (EDGE CASES)
    # --------------------------------------------------------------------------
    def test_edge_cases_zero_and_none(self):
        # Ділення на нуль або відсутність даних
        empty_data = {"edrpou": "00000000", "reports": {}}
        kpi = FinancialCalculator.calculate_company_kpis(empty_data)
        
        self.assertIsNone(kpi["ratios"]["current_ratio"]["value"])
        self.assertIsNone(kpi["ratios"]["roa"]["value"])
        self.assertIsNone(kpi["ratios"]["roe"]["value"])

        # Зміна від нуля
        self.assertEqual(FinancialCalculator.calculate_change_pct(0, 100), 100.0)
        self.assertEqual(FinancialCalculator.calculate_change_pct(0, -50), -100.0)
        self.assertEqual(FinancialCalculator.calculate_change_pct(0, 0), 0.0)
        self.assertIsNone(FinancialCalculator.calculate_change_pct(None, 100))

    # --------------------------------------------------------------------------
    # 6. ТЕСТУВАННЯ ОБРОБКИ РЯДКА 2350 (ПРИБУТОК) ТА 2355 (ЗБИТОК)
    # --------------------------------------------------------------------------
    def test_calculate_net_income_combinations(self):
        calc = FinancialCalculator.calculate_net_income

        # 1. Тільки прибуток (2350)
        self.assertEqual(calc(1000.0, None), 1000.0)
        self.assertEqual(calc(91059.0, None), 91059.0)

        # 2. Тільки збиток (2355 додатне число в XML)
        self.assertEqual(calc(None, 450.0), -450.0)

        # 3. Тільки збиток (2355 від'ємне число в XML, наприклад -450)
        self.assertEqual(calc(None, -450.0), -450.0)

        # 4. Рядок 2350 нуль, у 2355 збиток
        self.assertEqual(calc(0.0, 300.0), -300.0)
        self.assertEqual(calc(0.0, -300.0), -300.0)

        # 5. Обидва поля заповнені (2350 - 2355)
        self.assertEqual(calc(1000.0, 200.0), 800.0)
        self.assertEqual(calc(1000.0, -200.0), 800.0)

        # 6. Обидва порожні
        self.assertIsNone(calc(None, None))

        # 7. Обидва нулі
        self.assertEqual(calc(0.0, 0.0), 0.0)

    def test_kpis_calculation_with_net_loss(self):
        """
        Тестування підприємства зі збитком (поле 2350 порожнє, а збиток у полі 2355).
        Перевірка, що ROA, ROE та Чиста маржа коректно розраховуються з від'ємними значеннями.
        """
        loss_company = {
            "edrpou": "99999999",
            "name": 'ТОВ "Збиткове підприємство"',
            "reports": {
                "S0100115": {
                    "data": {
                        "1300": {"begin": 1800000, "end": 2000000}, # Активи = 2 млн
                        "1900": {"begin": 1800000, "end": 2000000}, # Баланс = 2 млн
                        "1495": {"begin": 1100000, "end": 1000000}, # Власний капітал = 1 млн
                    }
                },
                "S0100215": {
                    "data": {
                        "2000": {"current": 5000000, "previous": 4500000}, # Виручка = 5 млн
                        # 2350 порожнє або відсутнє!
                        "2355": {"current": 200000, "previous": None},     # Збиток = 200 тис. ₴
                    }
                }
            }
        }

        kpi = FinancialCalculator.calculate_company_kpis(loss_company)
        mm = kpi["main_metrics"]
        r = kpi["ratios"]

        # Чистий результат повинен бути -200,000 тис. ₴
        self.assertEqual(mm["net_income"]["current"], -200000.0)
        self.assertIsNone(mm["net_income"]["previous"])

        # ROA: (-200,000 / 2,000,000) * 100 = -10.0%
        self.assertAlmostEqual(r["roa"]["value"], -10.0, places=2)
        self.assertIn("2350/2355", r["roa"]["formula"])

        # ROE: (-200,000 / 1,000,000) * 100 = -20.0%
        self.assertAlmostEqual(r["roe"]["value"], -20.0, places=2)
        self.assertIn("2350/2355", r["roe"]["formula"])

        # Чиста маржа: (-200,000 / 5,000,000) * 100 = -4.0%
        self.assertAlmostEqual(r["net_margin"]["value"], -4.0, places=2)
        self.assertIn("2350/2355", r["net_margin"]["formula"])

    def test_micro_company_kpis_s0110014(self):
        """Перевірка розрахунку KPI для малого підприємства з комбінованою формою S0110014."""
        micro_company = {
            "edrpou": "40008320",
            "name": "ПП \"ТЕСТ-МІКРО\"",
            "year": 2025,
            "reports": {
                "S0110014": {
                    "balance": {
                        "1095": {"begin": 500.0, "end": 600.0},
                        "1100": {"begin": 200.0, "end": 250.0},
                        "1165": {"begin": 100.0, "end": 150.0},
                        "1195": {"begin": 400.0, "end": 500.0},
                        "1300": {"begin": 900.0, "end": 1100.0},
                        "1495": {"begin": 600.0, "end": 700.0},
                        "1595": {"begin": 100.0, "end": 100.0},
                        "1695": {"begin": 200.0, "end": 300.0},
                        "1900": {"begin": 900.0, "end": 1100.0},
                    },
                    "income": {
                        "2000": {"current": 2000.0, "previous": 1800.0},
                        "2280": {"current": 2000.0, "previous": 1800.0},
                        "2285": {"current": 1600.0, "previous": 1500.0},
                        "2290": {"current": 400.0, "previous": 300.0},
                        "2300": {"current": 72.0, "previous": 54.0},
                        "2350": {"current": 328.0, "previous": 246.0},
                    }
                }
            }
        }

        kpi = FinancialCalculator.calculate_company_kpis(micro_company)
        mm = kpi["main_metrics"]
        r = kpi["ratios"]

        self.assertEqual(mm["revenue"]["current"], 2000.0)
        self.assertEqual(mm["net_income"]["current"], 328.0)
        self.assertEqual(mm["assets"]["current"], 1100.0)
        self.assertEqual(mm["equity"]["current"], 700.0)

        # ROA: 328 / 1100 * 100 = 29.82%
        self.assertAlmostEqual(r["roa"]["value"], 29.82, places=1)
        # ROE: 328 / 700 * 100 = 46.86%
        self.assertAlmostEqual(r["roe"]["value"], 46.86, places=1)
        # Чиста маржа: 328 / 2000 * 100 = 16.4%
        self.assertAlmostEqual(r["net_margin"]["value"], 16.4, places=1)

    def test_calculate_company_weight_ranking(self):
        """Перевірка розрахунку вагового коефіцієнта (weight) для сортування компаній у пошуку."""
        # 1. Велике підприємство (повний комплект Ф1-Ф5, 1000 працівників, 5 млрд виручки)
        large_company_info = {"employees": 1000}
        large_forms = [
            {"code": "S0100115"}, {"code": "S0100215"}, 
            {"code": "S0100311"}, {"code": "S0104010"}, {"code": "S0105009"}
        ]
        large_reports = {
            "S0100215": {"income": {"2000": {"current": 5_000_000.0}}}  # 5 млрд грн
        }
        w_large = FinancialCalculator.calculate_company_weight(large_company_info, large_forms, large_reports)

        # 2. Мале підприємство (форма S0110014, 20 працівників, 5 млн виручки)
        small_company_info = {"employees": 20}
        small_forms = [{"code": "S0110014"}]
        small_reports = {
            "S0110014": {"income": {"2000": {"current": 5_000.0}}}
        }
        w_small = FinancialCalculator.calculate_company_weight(small_company_info, small_forms, small_reports)

        # 3. Мікропідприємство (форма S0111007, 1 працівник, без виручки)
        micro_company_info = {"employees": 1}
        micro_forms = [{"code": "S0111007"}]
        micro_reports = {}
        w_micro = FinancialCalculator.calculate_company_weight(micro_company_info, micro_forms, micro_reports)

        # 4. Неактивне підприємство (без форм)
        w_empty = FinancialCalculator.calculate_company_weight({}, [], {})

        # Перевірка строгої ієрархії ваг: Large >> Small >> Micro >> Empty
        self.assertGreater(w_large, w_small)
        self.assertGreater(w_small, w_micro)
        self.assertGreater(w_micro, w_empty)

        # Велике підприємство повинно мати понад 100,000 балів
        self.assertGreaterEqual(w_large, 100_000)
        # Пусте підприємство повинно мати 0
        self.assertEqual(w_empty, 0)

if __name__ == "__main__":
    unittest.main()

