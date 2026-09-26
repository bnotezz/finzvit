import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF1F2MS(BaseFormParser):
    """
    Парсер форми S0111007 (Форми № 1-мс, № 2-мс. Спрощений фінансовий звіт мікропідприємства).
    В одному XML об'єднано баланс і фінрезультати.
    """

    @property
    def form_code(self) -> str:
        return "S0111007"

    @property
    def form_name(self) -> str:
        return "Ф1-мс, Ф2-мс. Спрощений фінзвіт мікропідприємства"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {"balance": {}, "income": {}}

        balance: Dict[str, Dict[str, Optional[float]]] = {}
        income: Dict[str, Dict[str, Optional[float]]] = {}

        tag_pattern = re.compile(r"^([AB])(\d{4})_([34])$")

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            doc_type, code, col = match.groups()
            val = self._get_number(body, child.tag)

            if doc_type == "A":
                if code not in balance:
                    balance[code] = {"begin": None, "end": None}
                if col == "3":
                    balance[code]["begin"] = val
                elif col == "4":
                    balance[code]["end"] = val
            elif doc_type == "B":
                if code not in income:
                    income[code] = {"current": None, "previous": None}
                if col == "3":
                    income[code]["current"] = val
                elif col == "4":
                    income[code]["previous"] = val

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
