from typing import Dict, Any, List

class CompanyMetaBuilder:
    """
    Збирає зведену інформацію про компанію (meta.json) та єдиний консолідований JSON (edrpou.json)
    на основі всіх її поданих звітів.
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

            formatted_date = d_fill
            if d_fill and len(d_fill) == 8 and d_fill.isdigit():
                formatted_date = f"{d_fill[:2]}.{d_fill[2:4]}.{d_fill[4:]}"

            available_forms.append({
                "code": f_code,
                "title": f_name,
                "date_filled": formatted_date,
                "timestamp": ts
            })

        def form_sort_key(f):
            c = (f.get("code") or "").upper().strip()
            if c.startswith("S01001"): return 1
            if c.startswith("S01002"): return 2
            if c.startswith("S01100"): return 3
            if c.startswith("S01110"): return 4
            if c.startswith("S01003") or c.startswith("S01033"): return 5
            if c.startswith("S01040"): return 6
            if c.startswith("S01050"): return 7
            if c.startswith("S01060"): return 8
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

    @staticmethod
    def _clean_report_data(data: Any) -> Any:
        """
        Рекурсивно очищає дані від null-значень та порожніх словників для зменшення розміру JSON.
        """
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if v is None:
                continue
            if isinstance(v, dict):
                sub = CompanyMetaBuilder._clean_report_data(v)
                if sub:
                    cleaned[k] = sub
            else:
                cleaned[k] = v
        return cleaned

    @classmethod
    def build_unified_company_json(
        cls,
        company_info: Dict[str, Any],
        available_forms: List[Dict[str, Any]],
        reports: Dict[str, Any],
        year: int = 2025,
        last_updated: str = ""
    ) -> Dict[str, Any]:
        """
        Формує оптимізований єдиний консолідований JSON-документ /{year}/{edrpou}.json.
        Усуває надлишкове дублювання реквізитів підприємства та службових заголовків у кожній формі.
        """
        def form_sort_key(f):
            c = (f.get("code") or "").upper().strip()
            if c.startswith("S01001"): return 1
            if c.startswith("S01002"): return 2
            if c.startswith("S01100"): return 3
            if c.startswith("S01110"): return 4
            if c.startswith("S01003") or c.startswith("S01033"): return 5
            if c.startswith("S01040"): return 6
            if c.startswith("S01050"): return 7
            if c.startswith("S01060"): return 8
            return 9

        company_fields = [
            "edrpou", "name", "kved", "kved_name", "address",
            "territory", "opf_code", "opf_name", "director",
            "employees", "accounting_standard"
        ]
        doc = {}
        for f in company_fields:
            v = company_info.get(f)
            if v is not None and v != "":
                doc[f] = v
        if "edrpou" in doc:
            doc["edrpou"] = str(doc["edrpou"])

        sorted_forms = sorted(available_forms, key=form_sort_key)
        clean_forms = []
        for f in sorted_forms:
            item = {}
            for k in ["code", "title", "date_filled", "timestamp"]:
                if f.get(k):
                    item[k] = f[k]
            if item.get("code"):
                clean_forms.append(item)

        # Очищаємо звіти: зберігаємо лише фінансові дані без дублювання company та meta
        clean_reports = {}
        for form_code, rep in reports.items():
            if isinstance(rep, dict) and "data" in rep:
                raw_data = rep["data"]
            else:
                raw_data = rep
            cleaned_data = cls._clean_report_data(raw_data)
            clean_reports[form_code] = cleaned_data

        doc["available_forms"] = clean_forms
        if last_updated:
            doc["last_updated"] = last_updated
        doc["year"] = year
        doc["reports"] = clean_reports

        return doc
