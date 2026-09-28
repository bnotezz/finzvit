import os
import re
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

def _clean_str(val: Any, max_len: int = 255) -> str:
    """Очищає рядок від null-байтів та некоректних control-символів PostgreSQL."""
    if not val:
        return ""
    s = str(val).replace("\x00", "").replace("\r", " ").replace("\n", " ").strip()
    return s[:max_len]

def _clean_digits(val: Any, max_len: int = 10) -> str:
    if not val:
        return ""
    s = re.sub(r"\D", "", str(val))
    return s[:max_len]

class SupabaseUploader:
    """
    Ультра-компактний та надійний завантажувач реєстру підприємств у Supabase.
    Зберігає в базі лише мінімум для пошуку (edrpou, name, kved, year),
    що дозволяє вмістити 435,000+ компаній у ~40 МБ диска (замість 553 МБ).
    Всі детальні звіти, фінанси та адреси зберігаються в R2.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        local_output_dir: str = "output",
        save_local: bool = False
    ):
        self.url = supabase_url or os.getenv("SUPABASE_URL")
        self.key = (
            supabase_key 
            or os.getenv("SUPABASE_SECRET_KEY") 
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
            or os.getenv("SUPABASE_KEY")
        )
        self.local_output_dir = local_output_dir
        self.save_local = save_local
        self.client: Optional[Client] = None

        if not self.url or not self.key:
            logger.warning("⚠️ Параметри Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY) не вказано в .env.local.")
        else:
            if create_client:
                try:
                    self.client = create_client(self.url, self.key)
                    logger.info("✅ Supabase клієнт успішно ініціалізовано.")
                except Exception as e:
                    logger.warning("supabase-py ініціалізація не вдалася (%s), перемикання на direct REST HTTP API.", e)
            else:
                logger.info("✅ Supabase REST API клієнт успішно ініціалізовано (urllib).")

    def upsert_companies(
        self,
        companies: List[Dict[str, Any]],
        batch_size: int = 500,
        pbar=None
    ) -> bool:
        if not companies:
            return True

        # Локальне резервне збереження реєстру лише за запитом --save-local
        if self.save_local:
            local_path = os.path.join(self.local_output_dir, "companies_registry.json")
            try:
                os.makedirs(self.local_output_dir, exist_ok=True)
                with open(local_path, "w", encoding="utf-8") as f:
                    json.dump(companies, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error("Не вдалося зберегти локальний реєстр: %s", e)

        if not self.url or not self.key:
            if self.save_local:
                logger.warning("Реєстр збережено лише локально у: %s", os.path.join(self.local_output_dir, "companies_registry.json"))
            else:
                logger.warning("Supabase не налаштовано, дані не збережено.")
            return True

        # Формуємо ультра-легковагові записи
        records = []
        for c in companies:
            raw_edrpou = c.get("edrpou")
            raw_name = c.get("name")
            if not raw_edrpou or not raw_name:
                continue

            edrpou = _clean_digits(raw_edrpou, 10)
            name = _clean_str(raw_name, 255)
            kved = _clean_str(c.get("kved"), 10) or None
            
            try:
                year = int(c.get("year", 2025))
            except (ValueError, TypeError):
                year = 2025

            try:
                weight = int(c.get("weight", 0))
            except (ValueError, TypeError):
                weight = 0

            if edrpou and name:
                records.append({
                    "edrpou": edrpou,
                    "name": name,
                    "kved": kved,
                    "year": year,
                    "weight": weight
                })

        logger.info("Початок синхронізації %d компаній із Supabase (батчі по %d)...", len(records), batch_size)

        total_saved = 0
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            success = self._send_batch(batch)
            if success:
                total_saved += len(batch)
                if pbar:
                    pbar.update(len(batch))
            else:
                # Якщо весь батч повернув помилку (наприклад 400 Bad Request через один битий символ),
                # розбиваємо його на мікро-батчі по 50, щоб не втратити решту компаній
                logger.warning("Розбиття збійного батчу %d-%d на мікро-батчі...", i + 1, min(i + batch_size, len(records)))
                for sub_i in range(0, len(batch), 50):
                    sub_batch = batch[sub_i:sub_i + 50]
                    sub_success = self._send_batch(sub_batch)
                    if sub_success:
                        total_saved += len(sub_batch)
                        if pbar:
                            pbar.update(len(sub_batch))
                    else:
                        # Якщо навіть мікро-батч збійнув, пробуємо поштучно
                        for single_record in sub_batch:
                            if self._send_batch([single_record]):
                                total_saved += 1
                                if pbar:
                                    pbar.update(1)
                            else:
                                logger.error("Пропущено запис з помилкою валідації: ЄДРПОУ %s", single_record.get("edrpou"))

        logger.info("✅ Синхронізовано з Supabase: %d із %d компаній.", total_saved, len(records))
        return total_saved > 0

    def _send_batch(self, batch: List[Dict[str, Any]]) -> bool:
        if not batch:
            return True
        api_url = f"{self.url.rstrip('/')}/rest/v1/companies?on_conflict=edrpou"
        req_data = json.dumps(batch, ensure_ascii=False).encode("utf-8")
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json; charset=utf-8",
            "Prefer": "resolution=merge-duplicates,return=minimal"
        }
        try:
            req = urllib.request.Request(api_url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status in (200, 201, 204)
        except Exception as e:
            return False
