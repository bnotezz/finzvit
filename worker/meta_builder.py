from typing import Dict, Any, List

class CompanyMetaBuilder:
    """
    Збирає зведену інформацію про компанію (meta.json) на основі всіх її поданих звітів.
    """

    @classmethod
    def build_company_meta(cls, parsed_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        parsed_reports — список результатів parse() для однієї компанії.
        """
        if not parsed_reports:
            return {}

        # Беремо базову інформацію про компанію з першого повного звіту
        base_company: Dict[str, Any] = {}
        for rep in parsed_reports:
            comp = rep.get("company", {})
            if comp.get("name"):
                # Наповнюємо всіма непорожніми полями
                for k, v in comp.items():
                    if v and not base_company.get(k):
                        base_company[k] = v

        available_forms = []
        last_updated = ""

        for rep in parsed_reports:
            meta = rep.get("meta", {})
            f_code = meta.get("form_code")
            f_name = meta.get("form_name")
            d_fill = meta.get("date_filled")
            ts = meta.get("timestamp") or ""

            if ts > last_updated:
                last_updated = ts

            # Форматуємо дату заповнення якщо вона є, наприклад 05062026 -> 05.06.2026
            formatted_date = d_fill
            if d_fill and len(d_fill) == 8 and d_fill.isdigit():
                formatted_date = f"{d_fill[:2]}.{d_fill[2:4]}.{d_fill[4:]}"

            available_forms.append({
                "code": f_code,
                "title": f_name,
                "date_filled": formatted_date,
                "timestamp": ts
            })

        # Сортуємо форми: спочатку Баланс (Ф1), потім Фінрезультати (Ф2), потім інші
        def form_sort_key(f):
            c = f["code"]
            if "001" in c: return 1
            if "002" in c: return 2
            if "100" in c: return 3
            if "111" in c: return 4
            if "003" in c: return 5
            return 9

        available_forms.sort(key=form_sort_key)

        return {
            "edrpou": base_company.get("edrpou"),
            "name": base_company.get("name"),
            "kved": base_company.get("kved"),
            "kved_name": base_company.get("kved_name"),
            "address": base_company.get("address"),
            "territory": base_company.get("territory"),
            "opf_code": base_company.get("opf_code"),
            "opf_name": base_company.get("opf_name"),
            "director": base_company.get("director"),
            "employees": base_company.get("employees"),
            "accounting_standard": base_company.get("accounting_standard"),
            "available_forms": available_forms,
            "last_updated": last_updated,
            "year": 2025
        }
