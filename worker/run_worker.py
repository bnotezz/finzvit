#!/usr/bin/env python3
import os
import sys
import argparse
import logging
from collections import defaultdict
from typing import Dict, List, Any

from parsers import ParserRegistry
from scanner import ReportScanner, FileReportInfo
from meta_builder import CompanyMetaBuilder
from uploaders import R2Uploader, SupabaseUploader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("FinZvitWorker")

def process_reports(
    input_source: str,
    output_dir: str = "output",
    year: int = 2025,
    dry_run: bool = False
):
    logger.info("=" * 60)
    logger.info("🚀 Запуск FinZvit Data Worker")
    logger.info("Вхідне джерело: %s", input_source)
    logger.info("Директорія для виводу: %s", output_dir)
    logger.info("Звітний рік: %d", year)
    logger.info("=" * 60)

    # 1. Сканування та дедуплікація
    if os.path.isdir(input_source):
        logger.info("📂 Сканування директорії...")
        files = ReportScanner.scan_directory(input_source)
    elif zipfile_is_valid(input_source):
        logger.info("📦 Сканування ZIP-архіву...")
        files = ReportScanner.scan_zip(input_source)
    else:
        logger.error("❌ Джерело не знайдено або не є коректною папкою чи ZIP файлом: %s", input_source)
        sys.exit(1)

    logger.info("Знайдено унікальних актуальних звітів після дедуплікації: %d", len(files))
    if not files:
        logger.warning("Жодного звіту не знайдено.")
        return

    # 2. Групування за компаніями
    company_files: Dict[str, List[FileReportInfo]] = defaultdict(list)
    for f in files:
        company_files[f.edrpou].append(f)

    logger.info("Кількість унікальних підприємств: %d", len(company_files))

    # Ініціалізація аплоадерів
    r2 = R2Uploader(local_output_dir=output_dir)
    supabase = SupabaseUploader(local_output_dir=output_dir)

    all_companies_meta = []
    total_forms_processed = 0

    # 3. Парсинг та збереження
    for edrpou, report_list in company_files.items():
        parsed_reports_for_company = []

        for rep_info in report_list:
            parser = ParserRegistry.get_parser(rep_info.form_code)
            if not parser:
                logger.warning(
                    "⚠️ Не знайдено парсер для форми %s (ЄДРПОУ: %s)",
                    rep_info.form_code, edrpou
                )
                continue

            try:
                raw_bytes = ReportScanner.read_file_content(rep_info)
                parsed_data = parser.parse(
                    raw_bytes,
                    filename=rep_info.filename,
                    timestamp=rep_info.timestamp
                )
                parsed_reports_for_company.append(parsed_data)

                # Шлях збереження форми: {year}/{edrpou}/{form_code}.json
                form_key = f"{year}/{edrpou}/{rep_info.form_code}.json"
                if not dry_run:
                    r2.upload_json(form_key, parsed_data)

                total_forms_processed += 1
            except Exception as e:
                logger.error(
                    "❌ Помилка обробки файлу %s (%s): %s",
                    rep_info.filename, rep_info.form_code, e
                )

        if parsed_reports_for_company:
            # Збираємо зведені метадані компанії (meta.json)
            meta_json = CompanyMetaBuilder.build_company_meta(parsed_reports_for_company)
            meta_key = f"{year}/{edrpou}/meta.json"
            if not dry_run:
                r2.upload_json(meta_key, meta_json)

            all_companies_meta.append(meta_json)

    # 4. Синхронізація реєстру з Supabase
    if not dry_run and all_companies_meta:
        logger.info("Синхронізація реєстру компаній із Supabase...")
        supabase.upsert_companies(all_companies_meta)

    logger.info("=" * 60)
    logger.info("✅ Обробку завершено успішно!")
    logger.info("Оброблено звітів: %d", total_forms_processed)
    logger.info("Збережено компаній у реєстрі: %d", len(all_companies_meta))
    logger.info("=" * 60)

def zipfile_is_valid(path: str) -> bool:
    return os.path.isfile(path) and path.lower().endswith(".zip")

def main():
    parser = argparse.ArgumentParser(description="FinZvit Data Worker — парсинг та підготовка звітів")
    parser.add_argument(
        "--input", "-i",
        default="sample",
        help="Шлях до вхідної директорії або ZIP архіву (за замовчуванням 'sample')"
    )
    parser.add_argument(
        "--output", "-o",
        default="output",
        help="Директорія для збереження JSON (за замовчуванням 'output')"
    )
    parser.add_argument(
        "--year", "-y",
        type=int,
        default=2025,
        help="Звітний рік (за замовчуванням 2025)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Тестовий прогін без завантаження у віддалені сховища"
    )

    args = parser.parse_args()
    process_reports(
        input_source=args.input,
        output_dir=args.output,
        year=args.year,
        dry_run=args.dry_run
    )

if __name__ == "__main__":
    main()
