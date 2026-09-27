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

if __name__ == "__main__":
    unittest.main()
