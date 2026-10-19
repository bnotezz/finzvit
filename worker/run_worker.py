#!/usr/bin/env python3
import os
import io
import sys
import json
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
    from .financial_calc import FinancialCalculator
    from .uploaders import R2Uploader, SupabaseUploader, CloudflareCachePurge
except (ImportError, ValueError):
    from progress import ProgressBar
    from parsers import ParserRegistry
    from scanner import ReportScanner
    from meta_builder import CompanyMetaBuilder
    from financial_calc import FinancialCalculator
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
    purge_cf: bool = True,
    resource_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    resource_url: Optional[str] = None,
    remote_updated_at: Optional[str] = None
):
    input_source = os.path.expanduser(input_source)
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

    supabase = SupabaseUploader(local_output_dir=output_dir, save_local=save_local)
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
        zip_files = [
            os.path.join(input_source, f)
            for f in sorted(os.listdir(input_source))
            if f.lower().endswith(".zip") and os.path.isfile(os.path.join(input_source, f))
        ]
        if zip_files:
            logger.info("📂 У директорії %s виявлено %d ZIP-архівів:", input_source, len(zip_files))
            for zf in zip_files:
                logger.info("   - %s (%.1f МБ)", os.path.basename(zf), os.path.getsize(zf) / (1024 * 1024))
            total_forms_processed = _process_multiple_zips(
                zip_paths=zip_files,
                company_demographics=company_demographics,
                company_reports=company_reports,
                company_form_items=company_form_items,
                company_last_ts=company_last_ts
            )
        else:
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

        # Розраховуємо та вбудовуємо фінансові KPI
        kpis = FinancialCalculator.calculate_company_kpis(unified_json)
        if kpis:
            unified_json["financial_kpi"] = kpis

        # Розраховуємо вагу масштабу підприємства для пріоритетного показу в пошуку
        weight = FinancialCalculator.calculate_company_weight(
            company_info=comp_info,
            available_forms=forms,
            reports=reports
        )

        file_key = f"{year}/{edrpou}.json"

        # Локальне потокове збереження для мінімізації споживання оперативної пам'яті
        if save_local:
            loc_path = os.path.join(output_dir, file_key)
            os.makedirs(os.path.dirname(loc_path), exist_ok=True)
            with open(loc_path, "wb") as f:
                f.write(json.dumps(unified_json, ensure_ascii=False, separators=(',', ':')).encode("utf-8"))

        if not skip_r2 and not dry_run:
            upload_items.append((file_key, unified_json))

        # Легкий запис для Supabase та локального реєстру з вагою ранжування
        companies_registry_meta.append({
            "edrpou": edrpou,
            "name": comp_info.get("name"),
            "kved": comp_info.get("kved"),
            "year": year,
            "weight": weight
        })

        # Звільняємо пам'ять компанії одразу, якщо upload_items не накопичуються в RAM
        if (skip_r2 or dry_run) and edrpou in company_reports:
            del company_reports[edrpou]
            if edrpou in company_form_items:
                del company_form_items[edrpou]

        pbar_build.update(1)
    pbar_build.close()

    if save_local:
        reg_path = os.path.join(output_dir, f"companies_registry_{year}.json")
        try:
            with open(reg_path, "w", encoding="utf-8") as f:
                json.dump(companies_registry_meta, f, ensure_ascii=False, indent=2)
            logger.info("💾 Локальний реєстр компаній збережено у: %s", reg_path)
        except Exception as e:
            logger.warning("Не вдалося зберегти локальний реєстр: %s", e)

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
        elif save_local:
            logger.info("💾 Всі %d файлів збережено на локальний диск (%s/%d/)", unique_companies_count, output_dir, year)

    # 4. СИНХРОНІЗАЦІЯ РЕЄСТРУ З SUPABASE (УЛЬТРА-ЛЕГКОВИЙ ФОРМАТ)
    if not dry_run and not skip_supabase and companies_registry_meta:
        logger.info("🗄️ Синхронізація ультра-компактного реєстру з Supabase (%d компаній)...", len(companies_registry_meta))
        pbar_sb = ProgressBar(total=len(companies_registry_meta), prefix="Supabase Upsert", unit="co")
        supabase.upsert_companies(companies_registry_meta, batch_size=500, pbar=pbar_sb)
        pbar_sb.close()

    # 5. СКИДАННЯ КЕШУ CLOUDFLARE CDN
    if not dry_run and purge_cf and cf_cache.is_configured():
        cf_cache.purge_everything()

    # 6. ФІКСАЦІЯ ІМПОРТОВАНОГО ДАТАСЕТУ В ЖУРНАЛІ SUPABASE
    if not dry_run and not skip_supabase:
        file_hash = None
        file_name = os.path.basename(input_source)
        if os.path.isfile(input_source):
            try:
                import hashlib
                hasher = hashlib.md5()
                with open(input_source, "rb") as f:
                    for chunk in iter(lambda: f.read(1024 * 1024), b""):
                        hasher.update(chunk)
                file_hash = hasher.hexdigest()
            except Exception as e:
                logger.warning("Не вдалося розрахувати MD5 хеш файлу: %s", e)

        effective_name = resource_name or f"Фінансова звітність підприємств за {year} рік ({file_name})"
        supabase.log_imported_dataset(
            name=effective_name,
            year=year,
            resource_id=resource_id,
            dataset_id=dataset_id,
            url=resource_url,
            file_name=file_name,
            file_hash=file_hash,
            remote_updated_at=remote_updated_at,
            companies_count=unique_companies_count,
            forms_count=total_forms_processed,
            status="completed"
        )

    logger.info("=" * 60)
    logger.info("🎉 ВСІ ОПЕРАЦІЇ УСПІШНО ЗАВЕРШЕНО!")
    logger.info("Всього компаній у сховищі R2: %d (файлів: %d)", unique_companies_count, len(upload_items))
    logger.info("Всього форм звітів вкладено: %d", total_forms_processed)
    logger.info("=" * 60)


def _process_multiple_zips(
    zip_paths: List[str],
    company_demographics: Dict[str, Dict[str, Any]],
    company_reports: Dict[str, Dict[str, Any]],
    company_form_items: Dict[str, List[Dict[str, Any]]],
    company_last_ts: Dict[str, str]
) -> int:
    """
    Двоетапна потокова обробка списку ZIP-архівів із глобальною дедуплікацією версій:
    1. Швидке сканування метаданих усіх архівів без розпакування XML для знаходження найновіших версій звітів (ts).
    2. Потоковий парсинг виключно найсвіжіших версій звітів, згрупованих за архівами.
    """
    logger.info("🔍 Етап 1/2: Швидке сканування та дедуплікація версій у %d архівах...", len(zip_paths))
    # best_reports: (edrpou, form_code) -> (ts, master_zip_path, inner_zip_name, xml_filename)
    best_reports: Dict[Tuple[str, str], Tuple[str, str, Optional[str], str]] = {}
    total_xml_count = 0
    revisions_updated = 0

    for master_path in zip_paths:
        try:
            with zipfile.ZipFile(master_path, "r") as mzf:
                infolist = mzf.infolist()
                sub_zips = [item.filename for item in infolist if item.filename.lower().endswith(".zip") and not item.is_dir()]
                direct_xmls = [item.filename for item in infolist if item.filename.lower().endswith(".xml") and not item.is_dir()]

                if sub_zips:
                    for sub_name in sub_zips:
                        try:
                            inner_bytes = mzf.read(sub_name)
                            with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as izf:
                                for item in izf.infolist():
                                    if item.is_dir() or not item.filename.lower().endswith(".xml"):
                                        continue
                                    total_xml_count += 1
                                    parsed = ReportScanner.parse_filename(item.filename)
                                    if not parsed:
                                        continue
                                    edrpou, form_code, ts = parsed
                                    key = (edrpou, form_code)
                                    if key not in best_reports:
                                        best_reports[key] = (ts, master_path, sub_name, item.filename)
                                    elif ts > best_reports[key][0]:
                                        best_reports[key] = (ts, master_path, sub_name, item.filename)
                                        revisions_updated += 1
                            del inner_bytes
                        except Exception as e:
                            logger.warning("Помилка читання підархіву %s у %s: %s", sub_name, master_path, e)

                if direct_xmls:
                    for xml_name in direct_xmls:
                        total_xml_count += 1
                        parsed = ReportScanner.parse_filename(xml_name)
                        if not parsed:
                            continue
                        edrpou, form_code, ts = parsed
                        key = (edrpou, form_code)
                        if key not in best_reports:
                            best_reports[key] = (ts, master_path, None, xml_name)
                        elif ts > best_reports[key][0]:
                            best_reports[key] = (ts, master_path, None, xml_name)
                            revisions_updated += 1
        except Exception as e:
            logger.error("Не вдалося відкрити ZIP-архів %s: %s", master_path, e)

    logger.info("=" * 60)
    logger.info("📊 ПІДСУМОК СКАНУВАННЯ АРХІВІВ:")
    logger.info("Всього проскановано XML-документів: %d", total_xml_count)
    logger.info("Унікальних найсвіжіших форм: %d", len(best_reports))
    logger.info("Застарілих ревізій замінено новішими: %d", revisions_updated)
    logger.info("=" * 60)

    if not best_reports:
        return 0

    needed_subzips = defaultdict(lambda: defaultdict(list))
    needed_direct = defaultdict(list)

    for (edrpou, form_code), (ts, m_path, inner_name, x_name) in best_reports.items():
        if inner_name:
            needed_subzips[m_path][inner_name].append((x_name, edrpou, form_code, ts))
        else:
            needed_direct[m_path].append((x_name, edrpou, form_code, ts))

    logger.info("⚡ Етап 2/2: Потоковий парсинг %d унікальних звітів...", len(best_reports))
    pbar_parse = ProgressBar(total=len(best_reports), prefix="Парсинг XML", unit="doc")
    total_forms = 0

    for master_path in zip_paths:
        has_sub = master_path in needed_subzips
        has_dir = master_path in needed_direct
        if not has_sub and not has_dir:
            continue

        try:
            with zipfile.ZipFile(master_path, "r") as mzf:
                if has_sub:
                    for sub_name, files_to_read in needed_subzips[master_path].items():
                        try:
                            inner_bytes = mzf.read(sub_name)
                            with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as izf:
                                for xml_name, edrpou, form_code, ts in files_to_read:
                                    parser = ParserRegistry.get_parser(form_code)
                                    if not parser:
                                        pbar_parse.update(1)
                                        continue
                                    try:
                                        raw_xml = izf.read(xml_name)
                                        parsed_data = parser.parse(
                                            raw_xml,
                                            filename=os.path.basename(xml_name),
                                            timestamp=ts
                                        )
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
                                        logger.debug("Помилка парсингу %s: %s", xml_name, e)

                                    pbar_parse.update(1)
                            del inner_bytes
                        except Exception as e:
                            logger.warning("Помилка обробки підархіву %s: %s", sub_name, e)

                if has_dir:
                    for xml_name, edrpou, form_code, ts in needed_direct[master_path]:
                        parser = ParserRegistry.get_parser(form_code)
                        if not parser:
                            pbar_parse.update(1)
                            continue
                        try:
                            raw_xml = mzf.read(xml_name)
                            parsed_data = parser.parse(
                                raw_xml,
                                filename=os.path.basename(xml_name),
                                timestamp=ts
                            )
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
                            logger.debug("Помилка парсингу %s: %s", xml_name, e)

                        pbar_parse.update(1)
        except Exception as e:
            logger.error("Помилка читання архіву %s: %s", master_path, e)

    pbar_parse.close()
    del best_reports
    del needed_subzips
    del needed_direct
    import gc
    gc.collect()

    return total_forms


def _process_zip_master(
    master_zip_path: str,
    company_demographics: Dict[str, Dict[str, Any]],
    company_reports: Dict[str, Dict[str, Any]],
    company_form_items: Dict[str, List[Dict[str, Any]]],
    company_last_ts: Dict[str, str]
) -> int:
    """
    Однопрохідне потокове читання головного ZIP-архіву через загальний механізм.
    """
    return _process_multiple_zips(
        zip_paths=[master_zip_path],
        company_demographics=company_demographics,
        company_reports=company_reports,
        company_form_items=company_form_items,
        company_last_ts=company_last_ts
    )


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
    parser.add_argument(
        "--resource-id",
        default=None,
        help="ID ресурсу на data.gov.ua (наприклад fe3f6731-8a79-463b-b3af-03811d7a0e26)"
    )
    parser.add_argument(
        "--dataset-id",
        default=None,
        help="ID набору даних на data.gov.ua (наприклад 7436ae83-dfc1-4836-9962-8af3e831c522)"
    )
    parser.add_argument(
        "--upload-r2",
        action="store_true",
        help="Завантажувати в Cloudflare R2 (увімкнено за замовчуванням)"
    )
    parser.add_argument(
        "--upload-supabase",
        action="store_true",
        help="Синхронізувати з Supabase (увімкнено за замовчуванням)"
    )
    parser.add_argument(
        "--resource-name",
        "--dataset-name",
        dest="resource_name",
        default=None,
        help="Назва імпортованого ресурсу"
    )
    parser.add_argument(
        "--resource-url",
        "--file-url",
        dest="resource_url",
        default=None,
        help="URL файлу ресурсу на data.gov.ua"
    )
    parser.add_argument(
        "--remote-updated-at",
        default=None,
        help="Дата оновлення на порталі data.gov.ua (наприклад '2026-09-09 00:34:00+03:00')"
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
        purge_cf=not args.no_purge_cf,
        resource_id=args.resource_id,
        dataset_id=args.dataset_id,
        resource_name=args.resource_name,
        resource_url=args.resource_url,
        remote_updated_at=args.remote_updated_at
    )

if __name__ == "__main__":
    main()
