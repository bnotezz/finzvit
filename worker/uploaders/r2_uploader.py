import os
import ssl
import gzip
import json
import logging
import threading
from typing import Optional, Dict, Any, List, Tuple
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None

logger = logging.getLogger(__name__)

class R2Uploader:
    """
    Високопродуктивний та стійкий до багатопоточності завантажувач у Cloudflare R2 (S3 API).
    Оптимізації та захист від збоїв (SIGSEGV / OpenSSL race condition):
    - Thread-local S3 клієнти: кожен потік має власний ізольований SSLContext та boto3.Session,
      що повністю усуває гонитву потоків у libcrypto під час одночасного TLS рукостискання.
    - Прогрів (warmup) SSL/CA бандлу в головному потоці перед запуском пулу воркерів.
    - Обмежена черга in-flight запитів (sliding window) замість створення сотень тисяч одночасних Future,
      що зберігає гігабайти пам'яті під час завантаження 400k+ файлів.
    - Автоматичний retry (adaptive retry) при мережевих помилках та HTTP 429/503.
    """

    def __init__(
        self,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        local_output_dir: str = "output",
        save_local: bool = False,
        max_workers: int = 50
    ):
        self.account_id = account_id if account_id is not None else os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = access_key_id if access_key_id is not None else os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = secret_access_key if secret_access_key is not None else os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = bucket_name if bucket_name is not None else os.getenv("R2_BUCKET_NAME", "finzvit-data")
        self.local_output_dir = local_output_dir
        self.save_local = save_local
        self.max_workers = max(1, max_workers)

        self._thread_local = threading.local()
        self._endpoint_url = None
        self._configured = False
        self._main_client = None

        # Прогрів OpenSSL & CA store в головному потоці перед стартом воркерів
        self._warmup_ssl()

        has_keys = bool(self.account_id and self.access_key_id and self.secret_access_key)
        if not has_keys:
            logger.warning("⚠️ Параметри Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) не вказано в .env.local.")
        elif not boto3:
            logger.warning("⚠️ Бібліотеку boto3 не знайдено в поточному Python оточенні. Для завантаження в Cloudflare R2 виконайте: pip install boto3")
        else:
            try:
                self._endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
                self._main_client = self._create_s3_client()
                self._configured = True
                logger.info("✅ Cloudflare R2 клієнт успішно ініціалізовано (бакет: %s, потоків: %d).", self.bucket_name, self.max_workers)
            except Exception as e:
                logger.error("❌ Помилка ініціалізації клієнта R2: %s", e)
                self._configured = False

    @staticmethod
    def _warmup_ssl():
        """
        Прогріває глобальний контекст SSL та OpenSSL CA store в головному потоці.
        Запобігає race condition у libcrypto (ossl_x509_store_ctx_get_by_subject)
        при першому одночасному відкритті з'єднань багатьма потоками.
        """
        try:
            import certifi
            ca_file = certifi.where()
            _ = ssl.create_default_context(cafile=ca_file)
        except Exception:
            try:
                _ = ssl.create_default_context()
            except Exception:
                pass

    def _create_s3_client(self):
        """
        Створює новий ізольований клієнт boto3 S3 для конкретного потоку
        із власним пулом з'єднань та SSL-контекстом.
        """
        if not boto3 or not self._endpoint_url:
            return None
        session = boto3.session.Session()
        return session.client(
            "s3",
            endpoint_url=self._endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=Config(
                signature_version="s3v4",
                max_pool_connections=10,
                retries={"max_attempts": 5, "mode": "adaptive"},
                connect_timeout=15,
                read_timeout=30
            )
        )

    def get_client(self):
        """
        Повертає thread-local S3 клієнт для поточного робочого потоку.
        Забезпечує 100% ізоляцію OpenSSL context та з'єднань між потоками.
        """
        if not self._configured:
            return None
        client = getattr(self._thread_local, "client", None)
        if client is None:
            client = self._create_s3_client()
            self._thread_local.client = client
        return client

    @property
    def s3_client(self):
        return self.get_client() or self._main_client

    def is_configured(self) -> bool:
        return self._configured and (self._main_client is not None or self.get_client() is not None)

    def upload_json(self, key: str, data: Dict[str, Any]) -> bool:
        """
        Завантажує один JSON об'єкт.
        При записі в Cloudflare R2 стискає в пам'яті за допомогою gzip (рівень 6),
        зменшуючи розмір сховища на ~80-84% та прискорюючи передачу.
        """
        # Компактна серіалізація без зайвих пробілів (швидше передається мережею)
        json_bytes = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode("utf-8")

        # Локальне збереження: на диск зберігаємо звичайний відкритий JSON для легкого перегляду
        if self.save_local or not self.is_configured():
            local_path = os.path.join(self.local_output_dir, key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(json_bytes)

        client = self.get_client()
        if client and self.bucket_name:
            try:
                gzip_bytes = gzip.compress(json_bytes, compresslevel=6)
                client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=gzip_bytes,
                    ContentType="application/json; charset=utf-8",
                    ContentEncoding="gzip",
                    CacheControl="public, max-age=31536000, s-maxage=31536000, immutable"
                )
                return True
            except Exception as e:
                logger.error("Помилка завантаження в R2 ключа %s: %s", key, e)
                return False

        return True

    def upload_raw(
        self,
        key: str,
        raw_bytes: bytes,
        content_type: str = "application/json; charset=utf-8",
        compress: bool = True,
        cache_control: str = "public, max-age=86400, s-maxage=86400"
    ) -> bool:
        """
        Завантажує сирі байти (наприклад, файл реєстру або статичний контент)
        із можливістю попереднього gzip-стиснення.
        """
        if self.save_local or not self.is_configured():
            local_path = os.path.join(self.local_output_dir, key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(raw_bytes)

        client = self.get_client()
        if client and self.bucket_name:
            try:
                body = gzip.compress(raw_bytes, compresslevel=6) if compress else raw_bytes
                kwargs = {
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "Body": body,
                    "ContentType": content_type,
                    "CacheControl": cache_control
                }
                if compress:
                    kwargs["ContentEncoding"] = "gzip"

                client.put_object(**kwargs)
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
        Паралельне високошвидкісне завантаження списку пар (key, data) у Cloudflare R2.
        Використовує ковзне вікно задач (sliding window / bounded queue),
        що унеможливлює створення 400,000+ одночасних Future об'єктів
        і запобігає вичерпанню пам'яті та зависанню GC.
        """
        if not items:
            return 0

        if not self.is_configured() and not self.save_local:
            self.save_local = True

        success_count = 0

        def _worker(item: Tuple[str, Any]) -> bool:
            k, d = item
            try:
                return self.upload_json(k, d)
            finally:
                if pbar:
                    pbar.update(1)

        workers = min(self.max_workers, len(items)) if self.is_configured() else min(4, len(items))
        max_in_flight = max(workers * 4, 64)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            item_iter = iter(items)
            futures = set()

            # Початкове заповнення черги
            for _ in range(min(max_in_flight, len(items))):
                try:
                    it = next(item_iter)
                    futures.add(executor.submit(_worker, it))
                except StopIteration:
                    break

            # Ковзне вікно обробки: як тільки один future завершується, додаємо наступний
            while futures:
                done, futures = wait(futures, return_when=FIRST_COMPLETED)
                for f in done:
                    try:
                        if f.result():
                            success_count += 1
                    except Exception as e:
                        logger.error("Помилка в потоці завантаження: %s", e)

                while len(futures) < max_in_flight:
                    try:
                        it = next(item_iter)
                        futures.add(executor.submit(_worker, it))
                    except StopIteration:
                        break

        return success_count
