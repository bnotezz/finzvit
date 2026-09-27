import os
import json
import logging
from typing import Optional, Dict, Any, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None

logger = logging.getLogger(__name__)

class R2Uploader:
    """
    Високопродуктивний завантажувач файлів у Cloudflare R2 (S3 сумісний протокол).
    Підтримує:
    - Паралельне завантаження через ThreadPoolExecutor (30-50 потоків)
    - Пул HTTP-з'єднань (max_pool_connections=100)
    - Опціональне збереження на диск (--save-local), за замовчуванням False для збереження пам'яті/диска
    """

    def __init__(
        self,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        local_output_dir: str = "output",
        save_local: bool = False,
        max_workers: int = 40
    ):
        self.account_id = account_id or os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = access_key_id or os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = secret_access_key or os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = bucket_name or os.getenv("R2_BUCKET_NAME", "finzvit-data")
        self.local_output_dir = local_output_dir
        self.save_local = save_local
        self.max_workers = max_workers

        self.s3_client = None

        has_keys = bool(self.account_id and self.access_key_id and self.secret_access_key)
        if not has_keys:
            logger.warning("⚠️ Параметри Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) не вказано в .env.local.")
        elif not boto3:
            logger.warning("⚠️ Бібліотеку boto3 не знайдено в поточному Python оточенні. Для завантаження в Cloudflare R2 виконайте: pip install boto3")
        else:
            try:
                endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint_url,
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    config=Config(
                        signature_version="s3v4",
                        max_pool_connections=max(50, self.max_workers + 10)
                    )
                )
                logger.info("✅ Cloudflare R2 клієнт успішно ініціалізовано (бакет: %s, потоків: %d).", self.bucket_name, self.max_workers)
            except Exception as e:
                logger.error("❌ Помилка ініціалізації клієнта R2: %s", e)

    def upload_json(self, key: str, data: Dict[str, Any]) -> bool:
        """
        Завантажує один JSON об'єкт.
        """
        json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")

        # Локальне збереження (якщо увімкнено прапорцем або якщо R2 не налаштовано)
        if self.save_local or not self.s3_client:
            local_path = os.path.join(self.local_output_dir, key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(json_bytes)

        if self.s3_client and self.bucket_name:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=json_bytes,
                    ContentType="application/json; charset=utf-8",
                    CacheControl="public, max-age=31536000, s-maxage=31536000, immutable"
                )
                return True
            except Exception as e:
                logger.error("Помилка завантаження в R2 ключа %s: %s", key, e)
                return False

        return True

    def upload_batch_parallel(
        self,
        items: List[Tuple[str, Any]],
        pbar=None
    ) -> int:
        """
        Паралельне завантаження списку пар (key, data) у Cloudflare R2.
        Повертає кількість успішно завантажених об'єктів.
        """
        if not items:
            return 0

        # Якщо R2 відсутній і локальне збереження вимкнено — нема чого робити
        if not self.s3_client and not self.save_local:
            # Зберігаємо локально як fallback
            self.save_local = True

        success_count = 0

        def _worker(item: Tuple[str, Any]) -> bool:
            k, d = item
            res = self.upload_json(k, d)
            if pbar:
                pbar.update(1)
            return res

        # Використовуємо ThreadPoolExecutor
        workers = min(self.max_workers, len(items)) if self.s3_client else 4
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(_worker, it) for it in items]
            for f in as_completed(futures):
                try:
                    if f.result():
                        success_count += 1
                except Exception as e:
                    logger.error("Помилка в потоці завантаження: %s", e)

        return success_count
