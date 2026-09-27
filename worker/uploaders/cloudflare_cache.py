import os
import json
import logging
import urllib.request
from typing import List, Optional

logger = logging.getLogger(__name__)

class CloudflareCachePurge:
    """
    Утиліта для скидання кешу Cloudflare CDN / Worker через Cloudflare API v4.
    Підтримує:
    - Скидання за тегами (Cache-Tags)
    - Скидання за URL / префіксами
    - Повне скидання кешу (Purge Everything)
    """

    def __init__(
        self,
        api_token: Optional[str] = None,
        zone_id: Optional[str] = None
    ):
        self.api_token = (
            api_token 
            or os.getenv("CF_API_TOKEN") 
            or os.getenv("CLOUDFLARE_API_TOKEN")
        )
        self.zone_id = (
            zone_id 
            or os.getenv("CF_ZONE_ID") 
            or os.getenv("CLOUDFLARE_ZONE_ID")
        )

    def is_configured(self) -> bool:
        return bool(self.api_token and self.zone_id)

    def purge_tags(self, tags: List[str]) -> bool:
        """
        Скидає кеш за тегами (наприклад: ['company-32673400', 'year-2025'])
        Примітка: Cache-Tag очищення у Cloudflare доступне для Enterprise або за допомогою Cache Rules.
        """
        if not self.is_configured():
            return False
        return self._send_purge_request({"tags": tags})

    def purge_prefixes(self, prefixes: List[str]) -> bool:
        """
        Скидає кеш за префіксами URL (наприклад: ['finzvit.ua/data/2025/32673400/'])
        """
        if not self.is_configured():
            return False
        return self._send_purge_request({"prefixes": prefixes})

    def purge_everything(self) -> bool:
        """
        Повне очищення кешу зони (рекомендується викликати після повного імпорту набору даних).
        """
        if not self.is_configured():
            logger.info("ℹ️ Cloudflare API Token або Zone ID не налаштовано — скидання CDN кешу пропущено.")
            return False
        logger.info("🧹 Скидання всього CDN кешу Cloudflare для зони %s...", self.zone_id)
        return self._send_purge_request({"purge_everything": True})

    def _send_purge_request(self, payload: dict) -> bool:
        url = f"https://api.cloudflare.com/client/v4/zones/{self.zone_id}/purge_cache"
        data_bytes = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json; charset=utf-8",
        }
        try:
            req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if result.get("success"):
                    logger.info("✅ Кеш Cloudflare успішно очищено.")
                    return True
                else:
                    logger.warning("⚠️ Cloudflare повернув помилку при очищенні кешу: %s", result.get("errors"))
                    return False
        except Exception as e:
            logger.error("❌ Помилка запиту до Cloudflare Purge Cache API: %s", e)
            return False
