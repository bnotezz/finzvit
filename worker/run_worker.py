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

try:
    from .progress import ProgressBar
    from .parsers import ParserRegistry
    from .scanner import ReportScanner
    from .meta_builder import CompanyMetaBuilder
    from .uploaders import R2Uploader, SupabaseUploader, CloudflareCachePurge
except (ImportError, ValueError):
    from progress import ProgressBar
    from parsers import ParserRegistry
    from scanner import ReportScanner
    from meta_builder import CompanyMetaBuilder
    from uploaders import R2Uploader, SupabaseUploader, CloudflareCachePurge

def process_reports(
    input_source: str,
    output_dir: str = "output",
    year: int = 2025,
    threads: int = 50,
    save_local: bool = False,
    dry_run: bool = False,
    skip_r2: bool = False,
    skip_supabase: bool = False,
    purge_cf: bool = True
):
    logger.info("=" * 60)
    logger.info("🚀 Запуск FinZvit Data Worker (Unified Company JSON Engine)")
    logger.info("Вхідне джерело: %s", input_source)
    logger.info("Звітний рік: %d", year)
    logger.info("Паралельних потоків для R2: %d", threads)
    logger.info("Формат сховища: 1 консолідований JSON на компанію (/{year}/{edrpou}.json)")
    logger.info("Запис у R2: %s", "ВИМКНЕНО (--skip-r2 / --supabase-only)" if skip_r2 else "УВІМКНЕНО")
    logger.info("Синхронізація Supabase: %s", "ВИМКНЕНО" if skip_supabase else "УВІМКНЕНО")
    logger.info("Збереження на диск: %s", "Так" if save_local else "Ні (економія пам'яті/диска)")
    logger.info("Режим: %s", "DRY-RUN (тестовий)" if dry_run else "PRODUCTION (запис у сховища)")
    logger.info("=" * 60)

    # Ініціалізація клієнтів
    r2 = None
    if not skip_r2 and not dry_run:
        r2 = R2Uploader(
            local_output_dir=output_dir,
            save_local=save_local,
            max_workers=threads
        )

    supabase = SupabaseUploader(local_output_dir=output_dir)
    cf_cache = CloudflareCachePurge()

    # Сховища в пам'яті:
    # company_demographics: edrpou -> dict
    # company_reports: edrpou -> dict { form_code: parsed_data }
    # company_form_items: edrpou -> list of form summaries
    # company_last_ts: edrpou -> string
    company_demographics: Dict[str, Dict[str, Any]] = {}
    company_reports: Dict[str, Dict[str, Any]] = defaultdict(dict)
    company_form_items: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    company_last_ts: Dict[str, str] = defaultdict(str)

    total_forms_processed = 0

    # 1. ОБРОБКА ТА ПОТОКОВИЙ ПАРСИНГ ВХІДНОГО АРХІВУ/ПАПКИ
    if os.path.isfile(input_source) and input_source.lower().endswith(".zip"):
        total_forms_processed = _process_zip_master(
            master_zip_path=input_source,
            company_demographics=company_demographics,
            company_reports=company_reports,
            company_form_items=company_form_items,
            company_last_ts=company_last_ts
        )
    elif os.path.isdir(input_source):
        total_forms_processed = _process_directory(
            dir_path=input_source,
            company_demographics=company_demographics,
            company_reports=company_reports,
            company_form_items=company_form_items,
            company_last_ts=company_last_ts
        )
    else:
        logger.error("❌ Джерело не знайдено або не є ZIP архівом / папкою: %s", input_source)
        sys.exit(1)

    unique_companies_count = len(company_demographics)
    logger.info("=" * 60)
    logger.info("📊 ПІДСУМОК ПАРСИНГУ:")
    logger.info("Унікальних форм розпарсено: %d", total_forms_processed)
    logger.info("Унікальних компаній знайдено: %d", unique_companies_count)
    logger.info("=" * 60)

    if not unique_companies_count:
        logger.warning("Жодної компанії для обробки не знайдено.")
        return

    # 2. ФОРМУВАННЯ ЄДИНИХ КОНСОЛІДОВАНИХ ФАЙЛІВ ДЛЯ КОЖНОЇ КОМПАНІЇ
    logger.info("🛠️ Формування єдиних документів /{year}/{edrpou}.json (%d компаній)...", unique_companies_count)
    upload_items: List[Tuple[str, Dict[str, Any]]] = []
    companies_registry_meta: List[Dict[str, Any]] = []

    pbar_build = ProgressBar(total=unique_companies_count, prefix="Збирання JSON", unit="co")
    for edrpou, comp_info in company_demographics.items():
        forms = company_form_items.get(edrpou, [])
        reports = company_reports.get(edrpou, {})
        last_ts = company_last_ts.get(edrpou, "")

        unified_json = CompanyMetaBuilder.build_unified_company_json(
            company_info=comp_info,
            available_forms=forms,
            reports=reports,
            year=year,
            last_updated=last_ts
        )

        file_key = f"{year}/{edrpou}.json"
        upload_items.append((file_key, unified_json))

        # Легкий запис для Supabase
        companies_registry_meta.append({
            "edrpou": edrpou,
            "name": comp_info.get("name"),
            "kved": comp_info.get("kved"),
            "year": year
        })
        pbar_build.update(1)
    pbar_build.close()

    # Очищення проміжних структур з пам'яті перед запуском мережевих потоків
    del company_reports
    del company_form_items
    del company_last_ts
    import gc
    gc.collect()

    # 3. ВИСОКОШВИДКІСНЕ ЗАВАНТАЖЕННЯ В CLOUDFLARE R2 ТА/АБО ЗБЕРЕЖЕННЯ НА ДИСК
    if not dry_run:
        if not skip_r2 and r2:
            logger.info("☁️ Завантаження %d єдиних файлів у Cloudflare R2 (пул %d потоків)...", len(upload_items), threads)
            pbar_r2 = ProgressBar(total=len(upload_items), prefix="R2 Upload", unit="file")
            r2.upload_batch_parallel(upload_items, pbar=pbar_r2)
            pbar_r2.close()

            # Завантаження єдиного стисненого реєстру компаній для глобального пошуку
            if companies_registry_meta:
                import json as _json
                reg_bytes = _json.dumps(companies_registry_meta, ensure_ascii=False, separators=(',', ':')).encode("utf-8")
                logger.info("☁️ Завантаження стисненого реєстру companies_registry.json у Cloudflare R2 (%d компаній)...", len(companies_registry_meta))
                r2.upload_raw("companies_registry.json", reg_bytes, compress=True, cache_control="public, max-age=86400, s-maxage=86400")
        elif save_local:
            import json as _json
            logger.info("💾 Збереження %d файлів на локальний диск (%s)...", len(upload_items), output_dir)
            pbar_disk = ProgressBar(total=len(upload_items), prefix="Save Disk", unit="file")
            for k, d in upload_items:
                loc_path = os.path.join(output_dir, k)
                os.makedirs(os.path.dirname(loc_path), exist_ok=True)
                with open(loc_path, "wb") as f:
                    f.write(_json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode("utf-8"))
                pbar_disk.update(1)
            pbar_disk.close()

    # 4. СИНХРОНІЗАЦІЯ РЕЄСТРУ З SUPABASE (УЛЬТРА-ЛЕГКОВИЙ ФОРМАТ)
    if not dry_run and not skip_supabase and companies_registry_meta:
        logger.info("🗄️ Синхронізація ультра-компактного реєстру з Supabase (%d компаній)...", len(companies_registry_meta))
        pbar_sb = ProgressBar(total=len(companies_registry_meta), prefix="Supabase Upsert", unit="co")
        supabase.upsert_companies(companies_registry_meta, batch_size=500, pbar=pbar_sb)
        pbar_sb.close()

    # 5. СКИДАННЯ КЕШУ CLOUDFLARE CDN
    if not dry_run and purge_cf and cf_cache.is_configured():
        cf_cache.purge_everything()

    logger.info("=" * 60)
    logger.info("🎉 ВСІ ОПЕРАЦІЇ УСПІШНО ЗАВЕРШЕНО!")
    logger.info("Всього компаній у сховищі R2: %d (файлів: %d)", unique_companies_count, len(upload_items))
    logger.info("Всього форм звітів вкладено: %d", total_forms_processed)
    logger.info("=" * 60)


def _process_zip_master(
    master_zip_path: str,
    company_demographics: Dict[str, Dict[str, Any]],
    company_reports: Dict[str, Dict[str, Any]],
    company_form_items: Dict[str, List[Dict[str, Any]]],
    company_last_ts: Dict[str, str]
) -> int:
    """
    Однопрохідне потокове читання головного ZIP-архіву.
    Вичитує кожен підархів лише ОДИН раз у пам'ять, парсить потоково XML.
    """
    total_forms = 0

    with zipfile.ZipFile(master_zip_path, "r") as master_zf:
        infolist = master_zf.infolist()
        sub_zips = [item.filename for item in infolist if item.filename.lower().endswith(".zip") and not item.is_dir()]
        direct_xmls = [item.filename for item in infolist if item.filename.lower().endswith(".xml") and not item.is_dir()]

        if sub_zips:
            logger.info("📦 Виявлено %d підархівів у файлі %s", len(sub_zips), os.path.basename(master_zip_path))
            for idx, sub_zip_name in enumerate(sub_zips, 1):
                logger.info("👉 [%d/%d] Обробка підархіву: %s", idx, len(sub_zips), os.path.basename(sub_zip_name))
                
                # Читаємо підархів у пам'ять рівно 1 раз
                inner_bytes = master_zf.read(sub_zip_name)
                with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as inner_zf:
                    # Дедуплікація версій по infolist
                    dedup_items: Dict[Tuple[str, str], Tuple[str, str]] = {}
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

                    logger.info("   Знайдено %d унікальних звітів. Парсинг...", len(dedup_items))
                    pbar_parse = ProgressBar(total=len(dedup_items), prefix="   Парсинг XML", unit="doc")

                    for (edrpou, form_code), (ts, filename) in dedup_items.items():
                        parser = ParserRegistry.get_parser(form_code)
                        if not parser:
                            pbar_parse.update(1)
                            continue

                        try:
                            raw_xml = inner_zf.read(filename)
                            parsed_data = parser.parse(raw_xml, filename=os.path.basename(filename), timestamp=ts)

                            # Зберігаємо форму у словнику компанії
                            company_reports[edrpou][form_code] = parsed_data

                            # Оновлюємо демографічні реквізити компанії
                            comp = parsed_data.get("company", {})
                            if comp.get("name"):
                                if edrpou not in company_demographics:
                                    company_demographics[edrpou] = comp
                                else:
                                    for k, v in comp.items():
                                        if v and not company_demographics[edrpou].get(k):
                                            company_demographics[edrpou][k] = v

                            meta = parsed_data.get("meta", {})
                            d_fill = meta.get("date_filled")
                            formatted_date = d_fill
                            if d_fill and len(d_fill) == 8 and d_fill.isdigit():
                                formatted_date = f"{d_fill[:2]}.{d_fill[2:4]}.{d_fill[4:]}"

                            company_form_items[edrpou].append({
                                "code": form_code,
                                "title": meta.get("form_name", f"Форма {form_code}"),
                                "date_filled": formatted_date,
                                "timestamp": ts
                            })

                            if ts > company_last_ts[edrpou]:
                                company_last_ts[edrpou] = ts

                            total_forms += 1
                        except Exception as e:
                            logger.debug("Помилка парсингу %s: %s", filename, e)

                        pbar_parse.update(1)
                    pbar_parse.close()

                    del inner_bytes

        elif direct_xmls:
            logger.info("📦 Виявлено %d прямих XML файлів. Дедуплікація...", len(direct_xmls))
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

            for (edrpou, form_code), (ts, filename) in dedup_direct.items():
                parser = ParserRegistry.get_parser(form_code)
                if not parser:
                    pbar_direct.update(1)
                    continue

                try:
                    raw_xml = master_zf.read(filename)
                    parsed_data = parser.parse(raw_xml, filename=os.path.basename(filename), timestamp=ts)

                    company_reports[edrpou][form_code] = parsed_data
                    comp = parsed_data.get("company", {})
                    if comp.get("name"):
                        if edrpou not in company_demographics:
                            company_demographics[edrpou] = comp
                        else:
                            for k, v in comp.items():
                                if v and not company_demographics[edrpou].get(k):
                                    company_demographics[edrpou][k] = v

                    meta = parsed_data.get("meta", {})
                    d_fill = meta.get("date_filled")
                    formatted_date = d_fill
                    if d_fill and len(d_fill) == 8 and d_fill.isdigit():
                        formatted_date = f"{d_fill[:2]}.{d_fill[2:4]}.{d_fill[4:]}"

                    company_form_items[edrpou].append({
                        "code": form_code,
                        "title": meta.get("form_name", f"Форма {form_code}"),
                        "date_filled": formatted_date,
                        "timestamp": ts
                    })

                    if ts > company_last_ts[edrpou]:
                        company_last_ts[edrpou] = ts

                    total_forms += 1
                except Exception as e:
                    logger.debug("Помилка парсингу %s: %s", filename, e)

                pbar_direct.update(1)
            pbar_direct.close()

    return total_forms


def _process_directory(
    dir_path: str,
    company_demographics: Dict[str, Dict[str, Any]],
    company_reports: Dict[str, Dict[str, Any]],
    company_form_items: Dict[str, List[Dict[str, Any]]],
    company_last_ts: Dict[str, str]
) -> int:
    """
    Обробка локальної директорії.
    """
    logger.info("📂 Сканування директорії: %s", dir_path)
    files = ReportScanner.scan_directory(dir_path)
    logger.info("Знайдено унікальних звітів: %d", len(files))

    pbar = ProgressBar(total=len(files), prefix="Обробка файлів", unit="doc")
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
            edrpou = rep_info.edrpou
            form_code = rep_info.form_code

            company_reports[edrpou][form_code] = parsed_data
            comp = parsed_data.get("company", {})
            if comp.get("name"):
                if edrpou not in company_demographics:
                    company_demographics[edrpou] = comp
                else:
                    for k, v in comp.items():
                        if v and not company_demographics[edrpou].get(k):
                            company_demographics[edrpou][k] = v

            meta = parsed_data.get("meta", {})
            d_fill = meta.get("date_filled")
            formatted_date = d_fill
            if d_fill and len(d_fill) == 8 and d_fill.isdigit():
                formatted_date = f"{d_fill[:2]}.{d_fill[2:4]}.{d_fill[4:]}"

            company_form_items[edrpou].append({
                "code": form_code,
                "title": meta.get("form_name", f"Форма {form_code}"),
                "date_filled": formatted_date,
                "timestamp": rep_info.timestamp
            })

            if rep_info.timestamp > company_last_ts[edrpou]:
                company_last_ts[edrpou] = rep_info.timestamp

            total_forms += 1
        except Exception as e:
            logger.debug("Помилка обробки файлу %s: %s", rep_info.filename, e)

        pbar.update(1)
    pbar.close()

    return total_forms


def main():
    parser = argparse.ArgumentParser(description="FinZvit Data Worker — консолідований потоковий парсер")
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
        default=50,
        help="Кількість паралельних потоків для R2 (за замовчуванням 50)"
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
        "--supabase-only",
        action="store_true",
        help="Оновити виключно базу Supabase (пропускаючи R2)"
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
    skip_r2 = args.skip_r2 or args.supabase_only

    process_reports(
        input_source=args.input,
        output_dir=args.output,
        year=args.year,
        threads=args.threads,
        save_local=args.save_local,
        dry_run=args.dry_run,
        skip_r2=skip_r2,
        skip_supabase=args.skip_supabase,
        purge_cf=not args.no_purge_cf
    )

if __name__ == "__main__":
    main()
