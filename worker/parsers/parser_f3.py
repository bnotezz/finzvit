import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF3(BaseFormParser):
    """
    Парсер форми S0100311 (Форма № 3. Звіт про рух грошових коштів / за прямим методом).
    Офіційні графи форми:
      Графа 3 (A{код}_3) — За звітний період
      Графа 4 (A{код}_4) — За аналогічний період попереднього року
    """

    @property
    def form_code(self) -> str:
        return "S0100311"

    @property
    def form_name(self) -> str:
        return "Ф3. Звіт про рух грошових коштів"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {}

        result: Dict[str, Dict[str, Optional[float]]] = {}
        tag_pattern = re.compile(r"^A(\d{4})_([34])$")

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            code, col = match.groups()
            val = self._get_number(body, child.tag)

            if code not in result:
                result[code] = {"current": None, "previous": None}

            if col == "3":
                result[code]["current"] = val
            elif col == "4":
                result[code]["previous"] = val

        filtered = {
            code: vals for code, vals in result.items()
            if vals["current"] is not None or vals["previous"] is not None
        }

        return filtered
