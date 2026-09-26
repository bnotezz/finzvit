import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from .base_parser import BaseFormParser

class ParserGeneric(BaseFormParser):
    """
    Універсальний парсер для додаткових форм (Ф5 Примітки, Ф6 тощо).
    Витягує числові показники звітності, ігноруючи дублювання реквізитів підприємства.
    """

    COMPANY_TAGS = {
        "FIRM_NAME", "FIRM_EDRPOU", "FIRM_TERR", "FIRM_ADR", "FIRM_KVED", 
        "FIRM_KVEDNM", "FIRM_OPFCD", "FIRM_OPFNM", "FIRM_RUK", "FIRM_BUH",
        "FIRM_TELORG", "FIRM_TELOR", "FIRM_OGU", "FIRM_SPODU", "KATOTTG",
        "REP_PERNM", "REP_NYEAR", "REP_NMONTH", "LASTDAY", "MY_DATE", "OBL", "RAY"
    }

    def __init__(self, code: str = "GENERIC", name: str = "Додаток до фінансової звітності"):
        self._code = code
        self._name = name

    @property
    def form_code(self) -> str:
        return self._code

    @property
    def form_name(self) -> str:
        return self._name

    def extract_financial_data(self, body: Optional[ET.Element]) -> Dict[str, Any]:
        if body is None:
            return {}

        result: Dict[str, Any] = {}
        for child in body:
            tag = child.tag.strip()
            if tag in self.COMPANY_TAGS or tag.startswith("FIRM_"):
                continue

            nil = child.attrib.get("{http://www.w3.org/2001/XMLSchema-instance}nil", "false")
            if nil.lower() == "true":
                continue

            if child.text and child.text.strip():
                txt = child.text.strip()
                try:
                    num = float(txt.replace(" ", "").replace(",", "."))
                    result[tag] = int(num) if num.is_integer() else num
                except ValueError:
                    result[tag] = txt

        return result
