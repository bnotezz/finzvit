import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserF4(BaseFormParser):
    """
    Парсер форми S0104010 (Форма № 4. Звіт про власний капітал).
    Теги мають вигляд A{код}_{колонка} (наприклад A4000_3, A4000_5, A4095_10).
    """

    @property
    def form_code(self) -> str:
        return "S0104010"

    @property
    def form_name(self) -> str:
        return "Ф4. Звіт про власний капітал"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {}

        result: Dict[str, Dict[str, Optional[float]]] = {}
        tag_pattern = re.compile(r"^A(\d{4})_(\d+)$")

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            code, col = match.groups()
            val = self._get_number(body, child.tag)

            if code not in result:
                result[code] = {}

            result[code][f"col_{col}"] = val

        filtered = {
            code: cols for code, cols in result.items()
            if any(v is not None for v in cols.values())
        }

        return filtered
