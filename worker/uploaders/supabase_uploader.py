import os
import json
import logging
import urllib.request
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
    Працює як через офіційну бібліотеку supabase, так і напряму через urllib.request (zero dependencies).
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        local_output_dir: str = "output"
    ):
        self.url = supabase_url or os.getenv("SUPABASE_URL")
        self.key = (
            supabase_key 
            or os.getenv("SUPABASE_SECRET_KEY") 
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
            or os.getenv("SUPABASE_KEY")
        )
        self.local_output_dir = local_output_dir
        self.client: Optional[Client] = None

        if not self.url or not self.key:
            logger.warning("⚠️ Параметри Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY) не вказано в .env.local.")
        else:
            if create_client:
                try:
                    self.client = create_client(self.url, self.key)
                    logger.info("✅ Supabase клієнт успішно ініціалізовано (через supabase-py).")
                except Exception as e:
                    logger.warning("Supabase-py ініціалізація не вдалася (%s), перемикання на direct REST HTTP API.", e)
            else:
                logger.info("✅ Supabase REST API клієнт успішно ініціалізовано (через вбудований urllib).")

    def upsert_companies(
        self,
        companies: List[Dict[str, Any]],
        batch_size: int = 500,
        pbar=None
    ) -> bool:
        if not companies:
            return True

        # Зберігаємо локальний JSON реєстру
        local_path = os.path.join(self.local_output_dir, "companies_registry.json")
        try:
            os.makedirs(self.local_output_dir, exist_ok=True)
            with open(local_path, "w", encoding="utf-8") as f:
                json.dump(companies, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Не вдалося зберегти локальний реєстр: %s", e)

        if not self.url or not self.key:
            logger.warning("Реєстр збережено лише локально у: %s", local_path)
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

        logger.info("Початок синхронізації %d компаній із Supabase (батчі по %d)...", len(records), batch_size)

        success = True
        rpc_supported = True

        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                # 1. Спочатку пробуємо RPC-функцію з мульти-річним захистом (upsert_company_batch)
                if rpc_supported:
                    try:
                        if self.client:
                            self.client.rpc("upsert_company_batch", {"companies_data": batch}).execute()
                        else:
                            rpc_url = f"{self.url.rstrip('/')}/rest/v1/rpc/upsert_company_batch"
                            req_data = json.dumps({"companies_data": batch}, ensure_ascii=False).encode("utf-8")
                            headers = {
                                "apikey": self.key,
                                "Authorization": f"Bearer {self.key}",
                                "Content-Type": "application/json; charset=utf-8",
                            }
                            req = urllib.request.Request(rpc_url, data=req_data, headers=headers, method="POST")
                            with urllib.request.urlopen(req) as resp:
                                pass
                    except Exception as rpc_err:
                        # Якщо RPC функцію ще не створено в БД — перемикаємось на стандартний table upsert
                        rpc_supported = False
                        logger.warning("RPC upsert_company_batch недоступний (%s). Перехід на прямий table upsert.", rpc_err)

                # 2. Фолбек: звичайний upsert у таблицю companies
                if not rpc_supported:
                    if self.client:
                        self.client.table("companies").upsert(batch, on_conflict="edrpou").execute()
                    else:
                        api_url = f"{self.url.rstrip('/')}/rest/v1/companies?on_conflict=edrpou"
                        req_data = json.dumps(batch, ensure_ascii=False).encode("utf-8")
                        headers = {
                            "apikey": self.key,
                            "Authorization": f"Bearer {self.key}",
                            "Content-Type": "application/json; charset=utf-8",
                            "Prefer": "resolution=merge-duplicates,return=minimal"
                        }
                        req = urllib.request.Request(api_url, data=req_data, headers=headers, method="POST")
                        with urllib.request.urlopen(req) as resp:
                            pass

                if pbar:
                    pbar.update(len(batch))
            except Exception as e:
                logger.error("Помилка під час upsert батчу %d-%d у Supabase: %s", i + 1, min(i + batch_size, len(records)), e)
                success = False

        return success
