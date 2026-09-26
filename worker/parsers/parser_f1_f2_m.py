import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF1F2M(BaseFormParser):
    """
    Парсер форми S0110014 (Форми № 1-м, № 2-м. Фінансовий звіт малого підприємства).
    В одному XML об'єднано баланс і фінрезультати.
    Теги Балансу:
      A{код}_3 — На початок року
      A{код}_4 — На кінець звітного періоду
    Теги Фінрезультатів:
      B{код}_3 — За звітний період
      B{код}_4 — За попередній період
    """

    @property
    def form_code(self) -> str:
        return "S0110014"

    @property
    def form_name(self) -> str:
        return "Ф1-м, Ф2-м. Фінансовий звіт малого підприємства"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {"balance": {}, "income": {}}

        balance: Dict[str, Dict[str, Optional[float]]] = {}
        income: Dict[str, Dict[str, Optional[float]]] = {}

        # Регулярні вирази:
        # A1010_3, A1010_4 для балансу
        # B2000_3, B2000_4 для фінрезультатів
        tag_pattern = re.compile(r"^([AB])(\d{4})_([34])$")

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            doc_type, code, col = match.groups()
            val = self._get_number(body, child.tag)

            if doc_type == "A":
                # Баланс
                if code not in balance:
                    balance[code] = {"begin": None, "end": None}
                if col == "3":
                    balance[code]["begin"] = val
                elif col == "4":
                    balance[code]["end"] = val
            elif doc_type == "B":
                # Фінрезультати
                if code not in income:
                    income[code] = {"current": None, "previous": None}
                if col == "3":
                    income[code]["current"] = val
                elif col == "4":
                    income[code]["previous"] = val

        # Фільтрація порожніх
        filtered_balance = {
            c: v for c, v in balance.items()
            if v["begin"] is not None or v["end"] is not None
        }
        filtered_income = {
            c: v for c, v in income.items()
            if v["current"] is not None or v["previous"] is not None
        }

        return {
            "balance": filtered_balance,
            "income": filtered_income
        }
