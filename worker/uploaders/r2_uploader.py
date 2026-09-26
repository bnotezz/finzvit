import os
import json
import logging
from typing import Optional, Dict, Any

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None

logger = logging.getLogger(__name__)

class R2Uploader:
    """
    Завантажувач файлів у Cloudflare R2 (S3 сумісний протокол).
    Якщо параметри R2 відсутні, зберігає файли локально у задану директорію.
    """

    def __init__(
        self,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        local_output_dir: str = "output"
    ):
        self.account_id = account_id or os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = access_key_id or os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = secret_access_key or os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = bucket_name or os.getenv("R2_BUCKET_NAME", "finzvit-data")
        self.local_output_dir = local_output_dir

        self.s3_client = None
        if boto3 and self.account_id and self.access_key_id and self.secret_access_key:
            endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=Config(signature_version="s3v4")
            )
            logger.info("Cloudflare R2 клієнт успішно ініціалізовано.")
        else:
            logger.warning("Параметри Cloudflare R2 не знайдено. Файли зберігатимуться локально у: %s", self.local_output_dir)

    def upload_json(self, key: str, data: Dict[str, Any]) -> bool:
        """
        key — наприклад '2025/32673400/S0100115.json' або '2025/32673400/meta.json'
        """
        json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")

        # 1. Локальне збереження (завжди зберігаємо локальну копію або як fallback)
        local_path = os.path.join(self.local_output_dir, key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(json_bytes)

        # 2. Якщо підключено R2, заливаємо в хмару
        if self.s3_client and self.bucket_name:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=json_bytes,
                    ContentType="application/json; charset=utf-8",
                    CacheControl="public, max-age=86400"
                )
                return True
            except Exception as e:
                logger.error("Помилка завантаження в R2 ключа %s: %s", key, e)
                return False

        return True
