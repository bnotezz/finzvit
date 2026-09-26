import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF1(BaseFormParser):
    """
    Парсер форми S0100115 (Форма №1. Баланс / Звіт про фінансовий стан).
    Теги:
      A{код} — На початок звітного періоду
      B{код} — На кінець звітного періоду
    """

    @property
    def form_code(self) -> str:
        return "S0100115"

    @property
    def form_name(self) -> str:
        return "Ф1. Баланс"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {}

        result: Dict[str, Dict[str, Optional[float]]] = {}
        tag_pattern = re.compile(r"^([AB])(\d{4})$")

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            prefix, code = match.groups()
            val = self._get_number(body, child.tag)

            if code not in result:
                result[code] = {"begin": None, "end": None}

            if prefix == "A":
                result[code]["begin"] = val
            elif prefix == "B":
                result[code]["end"] = val

        # Очищаємо рядки, де обидва значення порожні (null)
        filtered = {
            code: vals for code, vals in result.items()
            if vals["begin"] is not None or vals["end"] is not None
        }

        return filtered
