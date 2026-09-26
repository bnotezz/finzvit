import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseFormParser(ABC):
    """
    Базовий абстрактний парсер для форм фінансової звітності (XML Держстату/ДПС).
    """

    @property
    @abstractmethod
    def form_code(self) -> str:
        """Код форми (наприклад 'S0100115')."""
        pass

    @property
    @abstractmethod
    def form_name(self) -> str:
        """Офіційна назва форми (наприклад 'Ф1. Баланс')."""
        pass

    def parse(self, xml_bytes: bytes, filename: str = "", timestamp: str = "") -> Dict[str, Any]:
        """
        Парсить бінарний XML і повертає стандартизовану структуру даних.
        """
        # ElementTree автоматично підтримує кодування зазначене у <?xml encoding="..."?>
        root = ET.fromstring(xml_bytes)
        
        head = root.find("DECLARHEAD")
        body = root.find("DECLARBODY")

        meta = self._parse_head(head, filename, timestamp)
        company = self._parse_company(body)
        data = self.extract_financial_data(body)

        return {
            "meta": meta,
            "company": company,
            "data": data
        }

    def _parse_head(self, head: Optional[ET.Element], filename: str, timestamp: str) -> Dict[str, Any]:
        meta = {
            "form_code": self.form_code,
            "form_name": self.form_name,
            "filename": filename,
            "timestamp": timestamp,
            "period_year": 2025,
            "period_month": 12,
            "date_filled": None,
            "software": None,
            "tin": None,
            "c_doc_cnt": None
        }

        if head is not None:
            tin_el = head.find("TIN")
            if tin_el is not None and tin_el.text:
                meta["tin"] = tin_el.text.strip()

            year_el = head.find("PERIOD_YEAR")
            if year_el is not None and year_el.text:
                try:
                    meta["period_year"] = int(year_el.text.strip())
                except ValueError:
                    pass

            month_el = head.find("PERIOD_MONTH")
            if month_el is not None and month_el.text:
                try:
                    meta["period_month"] = int(month_el.text.strip())
                except ValueError:
                    pass

            dfill_el = head.find("D_FILL")
            if dfill_el is not None and dfill_el.text:
                meta["date_filled"] = dfill_el.text.strip()

            soft_el = head.find("SOFTWARE")
            if soft_el is not None and soft_el.text:
                meta["software"] = soft_el.text.strip()

            cnt_el = head.find("C_DOC_CNT")
            if cnt_el is not None and cnt_el.text:
                meta["c_doc_cnt"] = cnt_el.text.strip()

        return meta

    def _parse_company(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        company = {
            "edrpou": None,
            "name": None,
            "kved": None,
            "kved_name": None,
            "address": None,
            "territory": None,
            "opf_code": None,
            "opf_name": None,
            "director": None,
            "accountant": None,
            "phone": None,
            "employees": None,
            "accounting_standard": None,
            "katottg": None
        }

        if body is None:
            return company

        def get_val(tag: str) -> Optional[str]:
            el = body.find(tag)
            if el is not None:
                nil = el.attrib.get("{http://www.w3.org/2001/XMLSchema-instance}nil", "false")
                if nil.lower() != "true" and el.text:
                    return el.text.strip()
            return None

        company["edrpou"] = get_val("FIRM_EDRPOU") or get_val("TIN")
        company["name"] = get_val("FIRM_NAME")
        company["kved"] = get_val("FIRM_KVED") or get_val("KVED")
        company["kved_name"] = get_val("FIRM_KVEDNM")
        company["address"] = get_val("FIRM_ADR")
        company["territory"] = get_val("FIRM_TERR")
        company["opf_code"] = get_val("FIRM_OPFCD")
        company["opf_name"] = get_val("FIRM_OPFNM")
        company["director"] = get_val("FIRM_RUK")
        company["accountant"] = get_val("FIRM_BUH")
        company["phone"] = get_val("FIRM_TELORG") or get_val("FIRM_TELOR")
        company["katottg"] = get_val("KATOTTG")

        # Кількість працівників (N3)
        emp = get_val("N3")
        if emp:
            try:
                company["employees"] = int(emp)
            except ValueError:
                pass

        # Стандарт обліку (N4=1 НП(С)БО, N5=1 МСФЗ)
        n4 = get_val("N4")
        n5 = get_val("N5")
        if n5 == "1":
            company["accounting_standard"] = "МСФЗ"
        elif n4 == "1":
            company["accounting_standard"] = "НП(С)БО"

        return company

    def _get_number(self, body: ET.Element, tag: str) -> Optional[float]:
        """
        Допоміжний метод вилучення числового значення тегу, ігнорує xsi:nil="true".
        """
        el = body.find(tag)
        if el is None:
            return None
        nil = el.attrib.get("{http://www.w3.org/2001/XMLSchema-instance}nil", "false")
        if nil.lower() == "true":
            return None
        if not el.text or not el.text.strip():
            return None
        
        txt = el.text.strip().replace(" ", "").replace(",", ".")
        try:
            # Якщо ціле число, зберігаємо як int для компактності, інакше float
            val = float(txt)
            return int(val) if val.is_integer() else val
        except ValueError:
            return None

    @abstractmethod
    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        """
        Витягує показники рядків форми у вигляді словника {код_рядка: {...}}.
        """
        pass
