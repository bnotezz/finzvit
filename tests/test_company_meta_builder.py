"""
Тести для CompanyMetaBuilder:
- Агрегація реквізитів підприємства з декількох звітів
- Канонічне сортування форм (Ф1, Ф2, Ф3/Ф3-н, Ф4, Ф5, Ф6)
- Форматування дати заповнення (ДД.ММ.РРРР)
- Побудова консолідованого документу /{year}/{edrpou}.json та його валідна JSON-серіалізація
"""

import json
import unittest
from worker.meta_builder import CompanyMetaBuilder


class TestCompanyMetaBuilder(unittest.TestCase):

    def test_build_company_meta_merging(self):
        """Агрегація реквізитів з різних форм (наприклад, якщо у Ф3 немає працівників, а у Ф1 є)."""
        rep_f1 = {
            "meta": {
                "form_code": "S0100115",
                "form_name": "Ф1. Баланс",
                "date_filled": "20022026",
                "timestamp": "2026-06-05 16:47:46"
            },
            "company": {
                "edrpou": "32673400",
                "name": "ТОВ \"КОРМОТЕХ\"",
                "employees": 1400,
                "accounting_standard": "НП(С)БО",
                "director": "Вовк Р.Р."
            },
            "data": {}
        }

        rep_f2 = {
            "meta": {
                "form_code": "S0100215",
                "form_name": "Ф2. Звіт про фінансові результати",
                "date_filled": "20022026",
                "timestamp": "2026-06-05 16:47:48"
            },
            "company": {
                "edrpou": "32673400",
                "name": "ТОВ \"КОРМОТЕХ\"",
                "kved": "10.92",
                "kved_name": "Виробництво готових кормів для домашніх тварин",
                "address": "Львівська обл., Яворівський р-н"
            },
            "data": {}
        }

        meta = CompanyMetaBuilder.build_company_meta([rep_f1, rep_f2])

        self.assertEqual(meta["edrpou"], "32673400")
        self.assertEqual(meta["name"], 'ТОВ "КОРМОТЕХ"')
        self.assertEqual(meta["employees"], 1400)
        self.assertEqual(meta["accounting_standard"], "НП(С)БО")
        self.assertEqual(meta["director"], "Вовк Р.Р.")
        self.assertEqual(meta["kved"], "10.92")
        self.assertEqual(meta["kved_name"], "Виробництво готових кормів для домашніх тварин")
        self.assertEqual(meta["address"], "Львівська обл., Яворівський р-н")
        self.assertEqual(meta["last_updated"], "2026-06-05 16:47:48")

        # Перевірка дати заповнення (20022026 -> 20.02.2026)
        self.assertEqual(meta["available_forms"][0]["date_filled"], "20.02.2026")

    def test_canonical_form_sorting(self):
        """Форми повинні сортуватися у правильній послідовності: Ф1 -> Ф2 -> Ф1-м/2-м -> Ф1-мс/2-мс -> Ф3/Ф3-н -> Ф4 -> Ф5."""
        forms = [
            {"form_code": "S0105009", "form_name": "Ф5. Примітки"},
            {"form_code": "S0104010", "form_name": "Ф4. Капітал"},
            {"form_code": "S0103355", "form_name": "Ф3-н. Рух коштів"},
            {"form_code": "S0111007", "form_name": "Ф1-мс, 2-мс"},
            {"form_code": "S0110014", "form_name": "Ф1-м, 2-м"},
            {"form_code": "S0100215", "form_name": "Ф2. Фінрезультати"},
            {"form_code": "S0100115", "form_name": "Ф1. Баланс"},
        ]

        reports = [{"meta": f, "company": {"name": "Test", "edrpou": "11111111"}} for f in forms]
        meta = CompanyMetaBuilder.build_company_meta(reports)
        sorted_codes = [f["code"] for f in meta["available_forms"]]

        expected = ["S0100115", "S0100215", "S0110014", "S0111007", "S0103355", "S0104010", "S0105009"]
        self.assertEqual(sorted_codes, expected)

    def test_build_unified_company_json_structure_and_serialization(self):
        """Побудова та валідація JSON-структури консолідованого звіту."""
        company_info = {
            "edrpou": "31316718",
            "name": "ТОВ \"НОВА ПОШТА\"",
            "kved": "53.20",
            "kved_name": "Інша поштова та кур'єрська діяльність",
            "address": "м. Київ, Столичне шосе, 103",
            "director": "Климов В.П.",
            "employees": 27572,
            "accounting_standard": "МСФЗ"
        }

        available_forms = [
            {"code": "S0100115", "title": "Ф1. Баланс"},
            {"code": "S0100215", "title": "Ф2. Звіт про фінансові результати"}
        ]

        reports = {
            "S0100115": {"meta": {}, "data": {"1000": {"begin": 78381, "end": 101388}}},
            "S0100215": {"meta": {}, "data": {"2000": {"current": 54101488, "previous": 43644151}}}
        }

        unified = CompanyMetaBuilder.build_unified_company_json(
            company_info=company_info,
            available_forms=available_forms,
            reports=reports,
            year=2025,
            last_updated="2026-04-23 12:19:58"
        )

        self.assertEqual(unified["edrpou"], "31316718")
        self.assertEqual(unified["year"], 2025)
        self.assertEqual(unified["last_updated"], "2026-04-23 12:19:58")
        self.assertIn("S0100115", unified["reports"])
        self.assertIn("S0100215", unified["reports"])

        # Перевіряємо валідність JSON-серіалізації з кирилицею
        json_str = json.dumps(unified, ensure_ascii=False, indent=2)
        self.assertIn("НОВА ПОШТА", json_str)
        self.assertIn("Інша поштова та кур'єрська діяльність", json_str)

        # Перевіряємо зворотній десеріалізований об'єкт
        loaded = json.loads(json_str)
        self.assertEqual(loaded["name"], 'ТОВ "НОВА ПОШТА"')
        # Дані форми зберігаються безпосередньо у reports[код] без зайвого дублювання company та meta
        self.assertNotIn("company", loaded["reports"]["S0100215"])
        self.assertNotIn("meta", loaded["reports"]["S0100215"])
        self.assertEqual(loaded["reports"]["S0100215"]["2000"]["current"], 54101488)


if __name__ == "__main__":
    unittest.main()
