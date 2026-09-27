import os
import io
import re
import zipfile
import logging
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Generator, BinaryIO

logger = logging.getLogger(__name__)

@dataclass
class FileReportInfo:
    edrpou: str
    form_code: str
    timestamp: str
    filename: str
    zip_path: Optional[str] = None   # Шлях до основного ZIP-архіву
    inner_zip: Optional[str] = None  # Ім'я підархіву всередині основного ZIP
    file_path: Optional[str] = None  # Прямий шлях до файлу на диску (якщо з папки)

class ReportScanner:
    """
    Сканер файлів фінансової звітності.
    Відповідає за вилучення ЄДРПОУ, форми, таймстемпу та дедуплікацію версій.
    """

    # Регулярний вираз для стандартного імені файлу:
    # 32673400_460140032673400S010011510000006122025.XML_2026-06-05 16:47:46.xml
    # або 00290771_230060000290771S010011510000137122025.XML_2026-02-24 06/22/26.xml
    FILENAME_PATTERN = re.compile(
        r"^(\d{8,10})_.*?(S\d{7})\d+.*?(?:\.XML_|\.xml_)(\d{4}[-/.]\d{2}[-/.]\d{2}\s+[\d:/]+)",
        re.IGNORECASE
    )

    # Альтернативний шаблон (якщо таймстемп відсутній у хвості імені)
    FALLBACK_PATTERN = re.compile(
        r"^(\d{8,10})_.*?(S\d{7})",
        re.IGNORECASE
    )

    @classmethod
    def parse_filename(cls, filename: str) -> Optional[Tuple[str, str, str]]:
        """
        Повертає кортеж (edrpou, form_code, timestamp).
        Нормалізує ЄДРПОУ до 8 цифр (відкидає ведучі нулі, якщо 10 знаків).
        """
        base_name = os.path.basename(filename)
        match = cls.FILENAME_PATTERN.search(base_name)
        if match:
            edrpou_raw, form_code, timestamp = match.groups()
            edrpou = cls._clean_edrpou(edrpou_raw)
            # Нормалізуємо таймстемп
            norm_ts = timestamp.replace("/", ":").replace(".", "-")
            return edrpou, form_code.upper(), norm_ts

        fallback = cls.FALLBACK_PATTERN.search(base_name)
        if fallback:
            edrpou_raw, form_code = fallback.groups()
            edrpou = cls._clean_edrpou(edrpou_raw)
            return edrpou, form_code.upper(), "1970-01-01 00:00:00"

        return None

    @staticmethod
    def _clean_edrpou(raw: str) -> str:
        s = raw.strip()
        if len(s) == 10 and s.startswith("00"):
            return s[2:]
        return s

    @classmethod
    def scan_directory(cls, dir_path: str) -> List[FileReportInfo]:
        """
        Сканує звичайну директорію з XML файлами та обирає найновіші версії.
        """
        dedup: Dict[Tuple[str, str], FileReportInfo] = {}

        for root, _, files in os.walk(dir_path):
            for file in files:
                if not file.lower().endswith(".xml"):
                    continue
                full_path = os.path.join(root, file)
                parsed = cls.parse_filename(file)
                if not parsed:
                    continue

                edrpou, form_code, ts = parsed
                key = (edrpou, form_code)

                info = FileReportInfo(
                    edrpou=edrpou,
                    form_code=form_code,
                    timestamp=ts,
                    filename=file,
                    file_path=full_path
                )

                if key not in dedup or ts > dedup[key].timestamp:
                    dedup[key] = info

        return list(dedup.values())

    @classmethod
    def scan_zip(cls, zip_file_path: str) -> List[FileReportInfo]:
        """
        Сканує ZIP архів з XML файлами та вкладеними підархівами (.zip) без розпакування на диск.
        """
        dedup: Dict[Tuple[str, str], FileReportInfo] = {}

        with zipfile.ZipFile(zip_file_path, "r") as zf:
            for item in zf.infolist():
                if item.is_dir():
                    continue

                # 1. Прямий XML файл в архіві
                if item.filename.lower().endswith(".xml"):
                    parsed = cls.parse_filename(item.filename)
                    if not parsed:
                        continue

                    edrpou, form_code, ts = parsed
                    key = (edrpou, form_code)

                    info = FileReportInfo(
                        edrpou=edrpou,
                        form_code=form_code,
                        timestamp=ts,
                        filename=item.filename,
                        zip_path=zip_file_path
                    )

                    if key not in dedup or ts > dedup[key].timestamp:
                        dedup[key] = info

                # 2. Вкладений підархів (.zip)
                elif item.filename.lower().endswith(".zip"):
                    try:
                        inner_bytes = zf.read(item.filename)
                        with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as inner_zf:
                            for inner_item in inner_zf.infolist():
                                if inner_item.is_dir() or not inner_item.filename.lower().endswith(".xml"):
                                    continue
                                parsed = cls.parse_filename(inner_item.filename)
                                if not parsed:
                                    continue

                                edrpou, form_code, ts = parsed
                                key = (edrpou, form_code)

                                info = FileReportInfo(
                                    edrpou=edrpou,
                                    form_code=form_code,
                                    timestamp=ts,
                                    filename=inner_item.filename,
                                    zip_path=zip_file_path,
                                    inner_zip=item.filename
                                )

                                if key not in dedup or ts > dedup[key].timestamp:
                                    dedup[key] = info
                    except Exception as e:
                        logger.error("Помилка сканування підархіву %s: %s", item.filename, e)

        return list(dedup.values())

    @classmethod
    def read_file_content(cls, info: FileReportInfo) -> bytes:
        """
        Зчитує байти XML-файлу з диску, з основного ZIP архіву або з вкладеного підархіву.
        """
        if info.file_path and os.path.exists(info.file_path):
            with open(info.file_path, "rb") as f:
                return f.read()

        if info.zip_path and os.path.exists(info.zip_path):
            with zipfile.ZipFile(info.zip_path, "r") as zf:
                if info.inner_zip:
                    # Читаємо з вкладеного підархіву
                    inner_bytes = zf.read(info.inner_zip)
                    with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as inner_zf:
                        return inner_zf.read(info.filename)
                else:
                    return zf.read(info.filename)

        raise FileNotFoundError(f"Неможливо відкрити файл для {info.edrpou} - {info.filename}")
