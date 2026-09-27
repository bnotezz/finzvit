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


class ParserF3Indirect(BaseFormParser):
    """
    Парсер форми S0103355 (Форма № 3-н. Звіт про рух грошових коштів / за непрямим методом).
    Офіційні графи форми:
      Звітний період:
        Графа 3 (A{код}_3) — Надходження / Прибуток
        Графа 4 (A{код}_4) — Видаток / Збиток
      Попередній рік:
        Графа 5 (A{код}_5) — Надходження / Прибуток
        Графа 6 (A{код}_6) — Видаток / Збиток
    """

    @property
    def form_code(self) -> str:
        return "S0103355"

    @property
    def form_name(self) -> str:
        return "Ф3-н. Звіт про рух грошових коштів (за непрямим методом)"

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {}

        tag_pattern = re.compile(r"^A(\d{4})_([3456])$")
        raw_cols: Dict[str, Dict[str, Optional[float]]] = {}

        for child in body:
            match = tag_pattern.match(child.tag)
            if not match:
                continue

            code, col = match.groups()
            val = self._get_number(body, child.tag)
            if val is not None:
                if code not in raw_cols:
                    raw_cols[code] = {}
                raw_cols[code][col] = val

        result: Dict[str, Dict[str, Any]] = {}
        for code, cols in raw_cols.items():
            val_3 = cols.get("3")
            val_4 = cols.get("4")
            val_5 = cols.get("5")
            val_6 = cols.get("6")

            # Рядки відтоку/видатків мають лише 4-у графу для поточного року або 6-у для попереднього
            current = None
            if val_3 is not None or val_4 is not None:
                if val_3 is not None and val_4 is not None:
                    current = val_3 - val_4
                elif val_3 is not None:
                    current = val_3
                else:
                    current = val_4

            previous = None
            if val_5 is not None or val_6 is not None:
                if val_5 is not None and val_6 is not None:
                    previous = val_5 - val_6
                elif val_5 is not None:
                    previous = val_5
                else:
                    previous = val_6

            result[code] = {
                "current": current,
                "previous": previous,
                "inflow_current": val_3,
                "outflow_current": val_4,
                "inflow_previous": val_5,
                "outflow_previous": val_6,
            }

        return result
