from typing import Dict, Optional
from .base_parser import BaseFormParser
from .parser_f1 import ParserF1
from .parser_f2 import ParserF2
from .parser_f3 import ParserF3
from .parser_f4 import ParserF4
from .parser_f1_f2_m import ParserF1F2M
from .parser_f1_f2_ms import ParserF1F2MS
from .parser_generic import ParserGeneric

class ParserRegistry:
    """
    Фабрика / Реєстр модульних парсерів за кодом форми.
    """
    _parsers: Dict[str, BaseFormParser] = {}

    @classmethod
    def register(cls, parser_instance: BaseFormParser):
        cls._parsers[parser_instance.form_code.upper()] = parser_instance

    @classmethod
    def get_parser(cls, form_code: str) -> Optional[BaseFormParser]:
        code = form_code.upper().strip()
        if code in cls._parsers:
            return cls._parsers[code]

        # Префіксний мапінг:
        prefix_map = {
            "S01001": ParserF1(),     # Ф1 Баланс
            "S01002": ParserF2(),     # Ф2 Фінрезультати
            "S01003": ParserF3(),     # Ф3 Рух коштів (прямий)
            "S01033": ParserF3(),     # Ф3-н Рух коштів (непрямий)
            "S01040": ParserF4(),     # Ф4 Власний капітал
            "S01100": ParserF1F2M(),  # 1-м, 2-м Малі підприємства
            "S01110": ParserF1F2MS(), # 1-мс, 2-мс Мікропідприємства
            "S01050": ParserGeneric("S0105009", "Ф5. Примітки до річної звітності"),
            "S01060": ParserGeneric("S0106007", "Ф6. Інформація за сегментами"),
        }

        for prefix, parser in prefix_map.items():
            if code.startswith(prefix):
                return parser

        # Фолбек
        return ParserGeneric(code, f"Форма {code}")

# Реєструємо екземпляри за замовчуванням
ParserRegistry.register(ParserF1())
ParserRegistry.register(ParserF2())
ParserRegistry.register(ParserF3())
ParserRegistry.register(ParserF4())
ParserRegistry.register(ParserF1F2M())
ParserRegistry.register(ParserF1F2MS())
