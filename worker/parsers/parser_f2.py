import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF2(BaseFormParser):
    """
    Парсер форми S0100215 (Форма №2. Звіт про фінансові результати / Звіт про сукупний дохід).
    Теги:
      A{код} — За звітний період
      B{код} — За аналогічний період попереднього року
    """

    @property
    def form_code(self) -> str:
        return "S0100215"

    @property
    def form_name(self) -> str:
        return "Ф2. Звіт про фінансові результати"

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
                result[code] = {"current": None, "previous": None}

            if prefix == "A":
                result[code]["current"] = val
            elif prefix == "B":
                result[code]["previous"] = val

        filtered = {
            code: vals for code, vals in result.items()
            if vals["current"] is not None or vals["previous"] is not None
        }

        return filtered
