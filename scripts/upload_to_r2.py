#!/usr/bin/env python3
"""
FinZvit High-Speed Resumable Cloudflare R2 Uploader
Завантажує локальні консолідовані JSON-звіти підприємств (/{year}/{edrpou}.json)
у сховище Cloudflare R2 із попереднім gzip-стисненням (compresslevel=6).

Особливості:
- Багатопотоковість із ізоляцією OpenSSL Context (Thread-local boto3)
- Bounded sliding window: потокове читання з диска без накопичення 400k+ файлів у RAM
- Контрольна точка (checkpoint): безпечне відновлення після зупинки або обриву зв'язку
- Graceful shutdown: коректне збереження стану при Ctrl+C (SIGINT/SIGTERM)
- Валідація та верифікація завантажених об'єктів
- Опціональна синхронізація реєстру з Supabase (--sync-supabase)
"""

import os
import sys
import time
import gzip
import signal
import logging
import argparse
from typing import Set, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

# Додаємо корінь проєкту до sys.path для імпорту модулів worker
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from worker.run_worker import _auto_load_env
_auto_load_env()

from worker.uploaders.r2_uploader import R2Uploader
from worker.progress import ProgressBar

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("R2BatchUploader")

# Глобальний прапорець для акуратного переривання за Ctrl+C
stop_requested = False

def _sigint_handler(signum, frame):
    global stop_requested
    if not stop_requested:
        logger.warning("\n⚠️ Отримано сигнал зупинки (Ctrl+C). Завершуємо поточні потоки та зберігаємо прогрес...")
        stop_requested = True
    else:
        logger.error("\nПримусове аварійне завершення!")
        sys.exit(1)

signal.signal(signal.SIGINT, _sigint_handler)
signal.signal(signal.SIGTERM, _sigint_handler)


def load_checkpoint(checkpoint_path: str) -> Set[str]:
    """Зчитує множину вже успішно завантажених кодів ЄДРПОУ з файлу чекпоінта."""
    uploaded = set()
    if os.path.isfile(checkpoint_path):
        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                for line in f:
                    ed = line.strip()
                    if ed:
                        uploaded.add(ed)
            logger.info("📋 Відновлено з чекпоінта: %d вже завантажених файлів (%s)", len(uploaded), checkpoint_path)
        except Exception as e:
            logger.warning("Не вдалося прочитати чекпоінт %s: %s", checkpoint_path, e)
    return uploaded


def append_checkpoint(checkpoint_file, edrpou: str):
    """Додає код ЄДРПОУ до відкритого файлу чекпоінта з негайним скиданням буфера."""
    checkpoint_file.write(f"{edrpou}\n")
    checkpoint_file.flush()


def verify_uploaded_sample(uploader: R2Uploader, year: int, sample_keys: list) -> bool:
    """Перевіряє коректність завантаження випадкової вибірки файлів у R2."""
    client = uploader.get_client()
    if not client:
        logger.error("R2 клієнт недоступний для верифікації")
        return False

    logger.info("🔍 Верифікація вибірки з %d файлів у R2 (Key, ContentEncoding, CacheControl)...", len(sample_keys))
    all_ok = True
    for key in sample_keys:
        try:
            resp = client.head_object(Bucket=uploader.bucket_name, Key=key)
            enc = resp.get("ContentEncoding")
            cache_ctrl = resp.get("CacheControl", "")
            size = resp.get("ContentLength", 0)

            if enc != "gzip":
                logger.error("❌ %s має некоректний ContentEncoding: %s (очікувався 'gzip')", key, enc)
                all_ok = False
            elif "immutable" not in cache_ctrl:
                logger.warning("⚠️ %s має неочікуваний CacheControl: %s", key, cache_ctrl)
            else:
                logger.info("  ✓ %s — OK (розмір в R2: %d байт, ContentEncoding: gzip)", key, size)
        except Exception as e:
            logger.error("❌ Помилка перевірки %s: %s", key, e)
            all_ok = False

    return all_ok


def upload_dataset(
    data_dir: str,
    year: int = 2023,
    threads: int = 50,
    batch_size: int = 200,
    limit: Optional[int] = None,
    checkpoint_path: Optional[str] = None,
    resume: bool = True,
    dry_run: bool = False,
    verify: bool = True,
    sync_supabase: bool = False,
):
    global stop_requested

    if not os.path.isdir(data_dir):
        logger.error("Директорія %s не існує!", data_dir)
        sys.exit(1)

    uploader = R2Uploader(max_workers=threads)
    if not dry_run and not uploader.is_configured():
        logger.error("Cloudflare R2 не налаштовано. Перевірте змінні R2_* у .env.local")
        sys.exit(1)

    if checkpoint_path is None:
        parent_dir = os.path.dirname(os.path.abspath(data_dir))
        checkpoint_path = os.path.join(parent_dir, f".r2_uploaded_{year}.txt")

    already_uploaded = load_checkpoint(checkpoint_path) if resume else set()

    logger.info("📂 Сканування файлів у: %s", data_dir)
    pending_files = []
    total_found = 0

    with os.scandir(data_dir) as it:
        for entry in it:
            if entry.name.endswith(".json"):
                total_found += 1
                edrpou = entry.name[:-5]
                if edrpou not in already_uploaded:
                    pending_files.append((edrpou, entry.path))
                    if limit and len(pending_files) >= limit:
                        break

    pending_count = len(pending_files)
    logger.info(
        "📊 Знайдено всього файлів: %d | Вже в R2: %d | До завантаження: %d",
        total_found, len(already_uploaded), pending_count
    )

    if pending_count == 0:
        logger.info("🎉 Усі файли вже завантажено в Cloudflare R2!")
        if verify and already_uploaded:
            sample_keys = [f"{year}/{ed}.json" for ed in list(already_uploaded)[:5]]
            verify_uploaded_sample(uploader, year, sample_keys)
        return

    if dry_run:
        logger.info("🔬 Режим DRY-RUN: завантаження не виконується.")
        for edrpou, path in pending_files[:5]:
            logger.info("  [DRY-RUN] Завантажився б: %s -> %s/%s.json", path, year, edrpou)
        return

    # Відкриваємо файл чекпоінта для дозапису
    os.makedirs(os.path.dirname(os.path.abspath(checkpoint_path)), exist_ok=True)
    checkpoint_file = open(checkpoint_path, "a", encoding="utf-8")

    logger.info("🚀 Запуск паралельного завантаження %d файлів у Cloudflare R2 (%d потоків)...", pending_count, threads)
    pbar = ProgressBar(total=pending_count, prefix=f"R2 {year}", unit="file")

    success_count = 0
    fail_count = 0
    uploaded_keys_sample = []

    def _upload_worker(item: Tuple[str, str]) -> Tuple[str, bool, Optional[str]]:
        edrpou, file_path = item
        key = f"{year}/{edrpou}.json"
        try:
            with open(file_path, "rb") as f:
                raw_bytes = f.read()

            gz_bytes = gzip.compress(raw_bytes, compresslevel=6)
            client = uploader.get_client()

            client.put_object(
                Bucket=uploader.bucket_name,
                Key=key,
                Body=gz_bytes,
                ContentType="application/json; charset=utf-8",
                ContentEncoding="gzip",
                CacheControl="public, max-age=31536000, s-maxage=31536000, immutable"
            )
            return edrpou, True, None
        except Exception as e:
            return edrpou, False, str(e)

    workers = min(threads, pending_count)
    max_in_flight = max(workers * 4, 128)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        item_iter = iter(pending_files)
        futures = set()

        # Початкове заповнення пулу задач
        for _ in range(min(max_in_flight, pending_count)):
            try:
                it = next(item_iter)
                futures.add(executor.submit(_upload_worker, it))
            except StopIteration:
                break

        # Ковзне вікно задач
        while futures and not stop_requested:
            done, futures = wait(futures, return_when=FIRST_COMPLETED)
            for f in done:
                edrpou, ok, err = f.result()
                if ok:
                    success_count += 1
                    append_checkpoint(checkpoint_file, edrpou)
                    if len(uploaded_keys_sample) < 10:
                        uploaded_keys_sample.append(f"{year}/{edrpou}.json")
                else:
                    fail_count += 1
                    logger.error("Помилка завантаження %s/%s.json: %s", year, edrpou, err)
                pbar.update(1)

            while len(futures) < max_in_flight and not stop_requested:
                try:
                    it = next(item_iter)
                    futures.add(executor.submit(_upload_worker, it))
                except StopIteration:
                    break

        if stop_requested:
            logger.warning("Зупиняємо активні задачі... Зачекайте.")
            for f in futures:
                f.cancel()

    pbar.close()
    checkpoint_file.close()

    logger.info(
        "✅ Підсумок завантаження: успішно: %d | з помилками: %d | чекпоінт збережено: %s",
        success_count, fail_count, checkpoint_path
    )

    # Верифікація завантаженої вибірки
    if verify and uploaded_keys_sample and not stop_requested:
        verify_uploaded_sample(uploader, year, uploaded_keys_sample[:5])

    # Синхронізація реєстру з Supabase за запитом
    if sync_supabase and not stop_requested:
        registry_path = os.path.join(
            os.path.dirname(os.path.abspath(data_dir)),
            f"companies_registry_{year}.json"
        )
        if os.path.isfile(registry_path):
            import json
            from worker.uploaders.supabase_uploader import SupabaseUploader
            logger.info("🔄 Синхронізація реєстру %s з Supabase...", registry_path)
            with open(registry_path, "r", encoding="utf-8") as f:
                registry_data = json.load(f)
            
            su = SupabaseUploader()
            pbar_sb = ProgressBar(total=len(registry_data), prefix=f"Supabase {year}", unit="comp")
            su.upsert_companies(registry_data, batch_size=500, pbar=pbar_sb)
            pbar_sb.close()
            logger.info("✅ Синхронізація Supabase завершена.")
        else:
            logger.warning("Файл реєстру %s не знайдено, пропуск синхронізації з Supabase.", registry_path)


def main():
    parser = argparse.ArgumentParser(description="FinZvit Resumable Cloudflare R2 Uploader")
    parser.add_argument("--dir", "-d", default="output/2023", help="Шлях до директорії звітів (напр. output/2023)")
    parser.add_argument("--year", "-y", type=int, default=2023, help="Звітний рік (за замовчуванням 2023)")
    parser.add_argument("--threads", "-t", type=int, default=50, help="Кількість паралельних потоків (за замовчуванням 50)")
    parser.add_argument("--limit", "-n", type=int, default=None, help="Обмежити кількість завантажених файлів (для тесту)")
    parser.add_argument("--checkpoint", default=None, help="Кастомний шлях до файлу чекпоінта")
    parser.add_argument("--no-resume", action="store_true", help="Не використовувати попередній чекпоінт")
    parser.add_argument("--dry-run", action="store_true", help="Тестовий прогін без запису в R2")
    parser.add_argument("--no-verify", action="store_true", help="Вимкнути пост-верифікацію вибірки файлів")
    parser.add_argument("--sync-supabase", action="store_true", help="Також синхронізувати companies_registry_{year}.json у Supabase")

    args = parser.parse_args()

    upload_dataset(
        data_dir=args.dir,
        year=args.year,
        threads=args.threads,
        limit=args.limit,
        checkpoint_path=args.checkpoint,
        resume=not args.no_resume,
        dry_run=args.dry_run,
        verify=not args.no_verify,
        sync_supabase=args.sync_supabase,
    )


if __name__ == "__main__":
    main()
