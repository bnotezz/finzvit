import os
import json
import logging
from typing import List, Dict, Any, Optional

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

logger = logging.getLogger(__name__)

class SupabaseUploader:
    """
    Завантажувач метаданих компаній у Supabase (таблиця 'companies').
    Підтримує батч-завантаження (upsert).
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        local_output_dir: str = "output"
    ):
        self.url = supabase_url or os.getenv("SUPABASE_URL")
        # Для воркера потрібен SERVICE_ROLE_KEY або anon key з правами
        self.key = supabase_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        self.local_output_dir = local_output_dir
        self.client: Optional[Client] = None

        if create_client and self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                logger.info("Supabase клієнт успішно ініціалізовано.")
            except Exception as e:
                logger.error("Помилка ініціалізації Supabase: %s", e)
        else:
            logger.warning("Параметри Supabase не знайдено. Реєстр зберігатиметься локально.")

    def upsert_companies(self, companies: List[Dict[str, Any]], batch_size: int = 200) -> bool:
        if not companies:
            return True

        # Завжди зберігаємо повний локальний JSON реєстру
        local_path = os.path.join(self.local_output_dir, "companies_registry.json")
        os.makedirs(self.local_output_dir, exist_ok=True)
        try:
            with open(local_path, "w", encoding="utf-8") as f:
                json.dump(companies, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Не вдалося зберегти локальний реєстр: %s", e)

        if not self.client:
            return True

        # Формуємо записи для таблиці companies
        records = []
        for c in companies:
            if not c.get("edrpou") or not c.get("name"):
                continue
            records.append({
                "edrpou": str(c.get("edrpou")),
                "name": str(c.get("name")),
                "kved": c.get("kved"),
                "kved_name": c.get("kved_name"),
                "address": c.get("address"),
                "territory": c.get("territory"),
                "opf_code": str(c.get("opf_code")) if c.get("opf_code") else None,
                "opf_name": c.get("opf_name"),
                "employees": c.get("employees"),
                "accounting_standard": c.get("accounting_standard"),
                "available_forms": c.get("available_forms", []),
                "year": c.get("year", 2025)
            })

        logger.info("Початок синхронізації %d компаній із Supabase...", len(records))

        success = True
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                response = self.client.table("companies").upsert(batch, on_conflict="edrpou").execute()
                logger.info("Завантажено батч %d-%d у Supabase", i + 1, min(i + batch_size, len(records)))
            except Exception as e:
                logger.error("Помилка під час upsert батчу: %s", e)
                success = False

        return success
