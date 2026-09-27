#!/usr/bin/env python3
import os
import io
import sys
import argparse
import logging
import zipfile
from collections import defaultdict
from typing import Dict, List, Any, Tuple, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("FinZvitWorker")

def _auto_load_env():
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(cur_dir, ".env.local"),
        os.path.join(cur_dir, ".env"),
        os.path.join(os.path.dirname(cur_dir), ".env.local"),
        os.path.join(os.path.dirname(cur_dir), ".env"),
    ]
    loaded = []
    for path in candidates:
        if os.path.isfile(path) and path not in loaded:
            loaded.append(path)
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k:
                        os.environ[k] = v
            logger.info("🔑 Змінні оточення завантажено з: %s", path)

_auto_load_env()

from progress import ProgressBar
from parsers import ParserRegistry
from scanner import ReportScanner
from meta_builder import CompanyMetaBuilder
from uploaders import R2Uploader, SupabaseUploader, CloudflareCachePurge

def process_reports(
    input_source: str,
    output_dir: str = "output",
    year: int = 2025,
    threads: int = 40,
    save_local: bool = False,
    dry_run: bool = False,
    skip_r2: bool = False,
    skip_supabase: bool = False,
    purge_cf: bool = True
):
    logger.info("=" * 60)
    logger.info("🚀 Запуск FinZvit Data Worker (High-Performance Engine)")
    logger.info("Вхідне джерело: %s", input_source)
    logger.info("Звітний рік: %d", year)
    logger.info("Паралельних потоків для R2: %d", threads)
    logger.info("Збереження локальних JSON на диск: %s", "Так" if save_local else "Ні (економія пам'яті/диска)")
    logger.info("Режим: %s", "DRY-RUN (тестовий)" if dry_run else "PRODUCTION (запис у сховища)")
    logger.info("=" * 60)

    # Ініціалізація клієнтів
    r2 = R2Uploader(
        local_output_dir=output_dir,
        save_local=save_local,
        max_workers=threads
    )
    supabase = SupabaseUploader(local_output_dir=output_dir)
    cf_cache = CloudflareCachePurge()

    # Словники для акумуляції метаданих компаній (легковагові summary)
    # edrpou -> list of {"company": {...}, "meta": {...}}
    company_summaries: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    total_forms_processed = 0

    # 1. ОБРОБКА ВХІДНОГО ДЖЕРЕЛА
    if os.path.isfile(input_source) and input_source.lower().endswith(".zip"):
        total_forms_processed = _process_zip_master(
            master_zip_path=input_source,
            year=year,
            r2=r2,
            company_summaries=company_summaries,
            dry_run=dry_run,
            skip_r2=skip_r2
        )
    elif os.path.isdir(input_source):
        total_forms_processed = _process_directory(
            dir_path=input_source,
            year=year,
            r2=r2,
            company_summaries=company_summaries,
            dry_run=dry_run,
            skip_r2=skip_r2
        )
    else:
        logger.error("❌ Джерело не знайдено або не є ZIP архівом / папкою: %s", input_source)
        sys.exit(1)

    unique_companies_count = len(company_summaries)
    logger.info("=" * 60)
    logger.info("📊 ПІДСУМОК ПАРСИНГУ:")
    logger.info("Унікальних звітів (форм) оброблено: %d", total_forms_processed)
    logger.info("Унікальних компаній знайдено: %d", unique_companies_count)
    logger.info("=" * 60)

    if not unique_companies_count:
        logger.warning("Жодної компанії для обробки не знайдено.")
        return

    # 2. ФОРМУВАННЯ ТА ЗАВАНТАЖЕННЯ META.JSON ДЛЯ ВСІХ КОМПАНІЙ
    logger.info("🛠️ Генерація зведених карток компаній (meta.json)...")
    meta_upload_items: List[Tuple[str, Dict[str, Any]]] = []
    all_companies_meta: List[Dict[str, Any]] = []

    pbar_meta = ProgressBar(total=unique_companies_count, prefix="Генерація meta.json", unit="co")
    for edrpou, summary_list in company_summaries.items():
        meta_json = CompanyMetaBuilder.build_company_meta(summary_list)
        meta_json["year"] = year
        meta_key = f"{year}/{edrpou}/meta.json"
        
        meta_upload_items.append((meta_key, meta_json))
        all_companies_meta.append(meta_json)
        pbar_meta.update(1)
    pbar_meta.close()

    # Завантаження meta.json в R2
    if not dry_run and not skip_r2:
        logger.info("☁️ Завантаження %d файлів meta.json у Cloudflare R2 (пул %d потоків)...", len(meta_upload_items), threads)
        pbar_r2_meta = ProgressBar(total=len(meta_upload_items), prefix="R2 Upload (meta)", unit="file")
        r2.upload_batch_parallel(meta_upload_items, pbar=pbar_r2_meta)
        pbar_r2_meta.close()

    # 3. СИНХРОНІЗАЦІЯ РЕЄСТРУ З SUPABASE
    if not dry_run and not skip_supabase and all_companies_meta:
        logger.info("🗄️ Синхронізація реєстру з Supabase (пакетами по 500)...")
        pbar_sb = ProgressBar(total=len(all_companies_meta), prefix="Supabase Upsert", unit="co")
        supabase.upsert_companies(all_companies_meta, batch_size=500, pbar=pbar_sb)
        pbar_sb.close()

    # 4. СКИДАННЯ КЕШУ CLOUDFLARE CDN
    if not dry_run and purge_cf and cf_cache.is_configured():
        cf_cache.purge_everything()

    logger.info("=" * 60)
    logger.info("🎉 ВСІ ОПЕРАЦІЇ УСПІШНО ЗАВЕРШЕНО!")
    logger.info("Всього форм завантажено: %d", total_forms_processed)
    logger.info("Компаній у реєстрі: %d", unique_companies_count)
    logger.info("=" * 60)


def _process_zip_master(
    master_zip_path: str,
    year: int,
    r2: R2Uploader,
    company_summaries: Dict[str, List[Dict[str, Any]]],
    dry_run: bool,
    skip_r2: bool
) -> int:
    """
    Високопродуктивна однопрохідна обробка головного ZIP-архіву.
    Вичитує кожен підархів лише ОДИН раз у пам'ять, парсить потоково XML
    і паралельно відвантажує пачки форм в R2.
    """
    total_forms = 0

    with zipfile.ZipFile(master_zip_path, "r") as master_zf:
        infolist = master_zf.infolist()
        # Знаходимо підархіви (.zip) та прямі XML файли
        sub_zips = [item.filename for item in infolist if item.filename.lower().endswith(".zip") and not item.is_dir()]
        direct_xmls = [item.filename for item in infolist if item.filename.lower().endswith(".xml") and not item.is_dir()]

        if sub_zips:
            logger.info("📦 Виявлено %d підархівів у головному файлі %s", len(sub_zips), os.path.basename(master_zip_path))
            for idx, sub_zip_name in enumerate(sub_zips, 1):
                logger.info("👉 [%d/%d] Обробка підархіву: %s", idx, len(sub_zips), os.path.basename(sub_zip_name))
                
                # 1. Читаємо підархів у пам'ять один раз
                inner_bytes = master_zf.read(sub_zip_name)
                with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as inner_zf:
                    # 2. Скануємо центральну директорію підархіву та дедуплікуємо версії
                    dedup_items: Dict[Tuple[str, str], Tuple[str, str]] = {} # (edrpou, form_code) -> (ts, item_name)
                    for item in inner_zf.infolist():
                        if item.is_dir() or not item.filename.lower().endswith(".xml"):
                            continue
                        parsed = ReportScanner.parse_filename(item.filename)
                        if not parsed:
                            continue
                        edrpou, form_code, ts = parsed
                        key = (edrpou, form_code)
                        if key not in dedup_items or ts > dedup_items[key][0]:
                            dedup_items[key] = (ts, item.filename)

                    logger.info("   Знайдено %d унікальних звітів у підархіві. Парсинг...", len(dedup_items))
                    
                    pbar_parse = ProgressBar(total=len(dedup_items), prefix="   Парсинг XML", unit="doc")
                    batch_upload_items: List[Tuple[str, Dict[str, Any]]] = []

                    # 3. Швидкий парсинг XML безпосередньо з відкритого внутрішнього архіву
                    for (edrpou, form_code), (ts, filename) in dedup_items.items():
                        parser = ParserRegistry.get_parser(form_code)
                        if not parser:
                            pbar_parse.update(1)
                            continue

                        try:
                            raw_xml = inner_zf.read(filename)
                            parsed_data = parser.parse(raw_xml, filename=os.path.basename(filename), timestamp=ts)

                            form_key = f"{year}/{edrpou}/{form_code}.json"
                            batch_upload_items.append((form_key, parsed_data))

                            # Зберігаємо тільки легковагове резюме для meta.json
                            company_summaries[edrpou].append({
                                "company": parsed_data.get("company", {}),
                                "meta": parsed_data.get("meta", {})
                            })
                            total_forms += 1
                        except Exception as e:
                            logger.debug("Помилка парсингу %s: %s", filename, e)

                        pbar_parse.update(1)
                    pbar_parse.close()

                    # 4. Паралельне вивантаження цієї пачки в R2
                    if not dry_run and not skip_r2 and batch_upload_items:
                        pbar_up = ProgressBar(total=len(batch_upload_items), prefix="   R2 Upload", unit="file")
                        r2.upload_batch_parallel(batch_upload_items, pbar=pbar_up)
                        pbar_up.close()

                    # Звільняємо пам'ять
                    del batch_upload_items
                    del inner_bytes

        elif direct_xmls:
            logger.info("📦 Виявлено %d прямих XML файлів у архіві. Дедуплікація...", len(direct_xmls))
            dedup_direct: Dict[Tuple[str, str], Tuple[str, str]] = {}
            for filename in direct_xmls:
                parsed = ReportScanner.parse_filename(filename)
                if not parsed:
                    continue
                edrpou, form_code, ts = parsed
                key = (edrpou, form_code)
                if key not in dedup_direct or ts > dedup_direct[key][0]:
                    dedup_direct[key] = (ts, filename)

            pbar_direct = ProgressBar(total=len(dedup_direct), prefix="Парсинг XML", unit="doc")
            batch_direct: List[Tuple[str, Dict[str, Any]]] = []

            for (edrpou, form_code), (ts, filename) in dedup_direct.items():
                parser = ParserRegistry.get_parser(form_code)
                if not parser:
                    pbar_direct.update(1)
                    continue

                try:
                    raw_xml = master_zf.read(filename)
                    parsed_data = parser.parse(raw_xml, filename=os.path.basename(filename), timestamp=ts)
                    form_key = f"{year}/{edrpou}/{form_code}.json"
                    batch_direct.append((form_key, parsed_data))

                    company_summaries[edrpou].append({
                        "company": parsed_data.get("company", {}),
                        "meta": parsed_data.get("meta", {})
                    })
                    total_forms += 1
                except Exception as e:
                    logger.debug("Помилка парсингу %s: %s", filename, e)

                pbar_direct.update(1)
            pbar_direct.close()

            if not dry_run and not skip_r2 and batch_direct:
                pbar_up = ProgressBar(total=len(batch_direct), prefix="R2 Upload", unit="file")
                r2.upload_batch_parallel(batch_direct, pbar=pbar_up)
                pbar_up.close()

    return total_forms


def _process_directory(
    dir_path: str,
    year: int,
    r2: R2Uploader,
    company_summaries: Dict[str, List[Dict[str, Any]]],
    dry_run: bool,
    skip_r2: bool
) -> int:
    """
    Обробка локальної директорії.
    """
    logger.info("📂 Сканування директорії: %s", dir_path)
    files = ReportScanner.scan_directory(dir_path)
    logger.info("Знайдено унікальних актуальних звітів: %d", len(files))

    pbar = ProgressBar(total=len(files), prefix="Обробка файлів", unit="doc")
    batch_upload_items: List[Tuple[str, Dict[str, Any]]] = []
    total_forms = 0

    for rep_info in files:
        parser = ParserRegistry.get_parser(rep_info.form_code)
        if not parser:
            pbar.update(1)
            continue

        try:
            raw_bytes = ReportScanner.read_file_content(rep_info)
            parsed_data = parser.parse(
                raw_bytes,
                filename=rep_info.filename,
                timestamp=rep_info.timestamp
            )
            form_key = f"{year}/{rep_info.edrpou}/{rep_info.form_code}.json"
            batch_upload_items.append((form_key, parsed_data))

            company_summaries[rep_info.edrpou].append({
                "company": parsed_data.get("company", {}),
                "meta": parsed_data.get("meta", {})
            })
            total_forms += 1
        except Exception as e:
            logger.debug("Помилка обробки файлу %s: %s", rep_info.filename, e)

        pbar.update(1)
    pbar.close()

    if not dry_run and not skip_r2 and batch_upload_items:
        pbar_up = ProgressBar(total=len(batch_upload_items), prefix="R2 Upload", unit="file")
        r2.upload_batch_parallel(batch_upload_items, pbar=pbar_up)
        pbar_up.close()

    return total_forms


def main():
    parser = argparse.ArgumentParser(description="FinZvit Data Worker — швидкісний потоковий парсер фінансової звітності")
    parser.add_argument(
        "--input", "-i",
        default="sample/fin_zvit_2025_sample.zip",
        help="Шлях до ZIP архіву або папки"
    )
    parser.add_argument(
        "--output", "-o",
        default="output",
        help="Директорія для локального збереження (за замовчуванням 'output')"
    )
    parser.add_argument(
        "--year", "-y",
        type=int,
        default=2025,
        help="Звітний рік (за замовчуванням 2025)"
    )
    parser.add_argument(
        "--threads", "-t",
        type=int,
        default=40,
        help="Кількість паралельних потоків для R2 (за замовчуванням 40)"
    )
    parser.add_argument(
        "--save-local",
        action="store_true",
        help="Зберігати копії JSON на локальний диск (за замовчуванням False)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Тестовий запуск без завантаження у віддалені сховища"
    )
    parser.add_argument(
        "--skip-r2",
        action="store_true",
        help="Пропустити завантаження звітів у Cloudflare R2"
    )
    parser.add_argument(
        "--skip-supabase",
        action="store_true",
        help="Пропустити синхронізацію з Supabase"
    )
    parser.add_argument(
        "--no-purge-cf",
        action="store_true",
        help="Не скидати кеш Cloudflare після завершення"
    )

    args = parser.parse_args()
    process_reports(
        input_source=args.input,
        output_dir=args.output,
        year=args.year,
        threads=args.threads,
        save_local=args.save_local,
        dry_run=args.dry_run,
        skip_r2=args.skip_r2,
        skip_supabase=args.skip_supabase,
        purge_cf=not args.no_purge_cf
    )

if __name__ == "__main__":
    main()
