#!/usr/bin/env python3
"""
FinZvit Security & Secret Leak Scanner
Перевіряє репозиторій та staged-файли на наявність випадково доданих секретів:
- Токени Cloudflare API, R2 Access/Secret Keys
- Supabase Service Role / Anon JWT ключі
- Приватні ключі SSL/SSH (*.pem, *.key, *.pfx)
- Файли конфігурацій середовища (.env*)
- Рядки підключення до баз даних з реальними паролями
"""

import os
import sys
import re
import argparse
import subprocess

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"

# 1. Заборонені імена файлів у Git
BLOCKED_FILENAMES = [
    re.compile(r"^\.env(\..+)?$"),                      # .env, .env.local, .env.production тощо
    re.compile(r".*\.pem$"),                            # Приватні сертифікати
    re.compile(r".*\.key$"),                            # Приватні ключі
    re.compile(r".*\.p12$"),                            # PKCS#12 контейнери
    re.compile(r".*\.pfx$"),                            # PFX контейнери
    re.compile(r"^id_rsa$"),                            # SSH ключі
    re.compile(r"^id_ed25519$"),
    re.compile(r"^credentials\.json$"),                 # Google/AWS облікові дані
    re.compile(r".*service[-_]account.*\.json$"),       # Service Accounts
]

# Файли-винятки, яким дозволено містити шаблони змінних оточення
ALLOWED_FILENAMES = {
    ".env.example",
    ".env.template",
    "sample.env",
}

# 2. Регулярні вирази для пошуку секретів у вмісті файлів
SECRET_PATTERNS = [
    (
        "Supabase / JWT Token",
        re.compile(r"eyJh[A-Za-z0-9_-]{10,}\.eyJh[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    ),
    (
        "Cloudflare API Token / Key",
        re.compile(r"(?i)(?:cloudflare|cf)[-_]?(?:api[-_]?token|auth[-_]?key|secret)\s*[:=]\s*['\"][A-Za-z0-9_-]{20,}['\"]"),
    ),
    (
        "AWS / R2 Access Key ID",
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "AWS / R2 Secret Access Key",
        re.compile(r"(?i)(?:aws|r2|s3)[-_]?(?:secret|access[-_]?key)\s*[:=]\s*['\"][A-Za-z0-9/+=]{30,}['\"]"),
    ),
    (
        "Private Key Header",
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"),
    ),
    (
        "PostgreSQL Connection URI with Password",
        re.compile(r"postgres(?:ql)?:\/\/[a-zA-Z0-9_\-]+:(?!password|postgres|user|xxx|<)[^@\s\"']+@[a-zA-Z0-9_\-\.]+"),
    ),
    (
        "Hardcoded Secret / API Key Assignment",
        re.compile(r"(?i)(?:secret[-_]?key|api[-_]?key|auth[-_]?token)\s*[:=]\s*['\"][A-Za-z0-9_\-\.]{24,}['\"]"),
    ),
]

# Ігноруємо відомі безпечні плейсхолдери та назви колонок/таблиць
SAFE_PLACEHOLDERS = [
    "placeholder",
    "example",
    "your-",
    "dummy",
    "changeme",
    "xxxx",
    "<token>",
    "<api_key>",
    "change_me",
    "supabase_anon_key",
    "cf_api_token",
    "r2_access_key",
    "127849138586737fd0c1fcb9f0ac9034", # Відкритий хеш архіву data.gov.ua
    "ed0428c4f1e352fbb142f7ad633f5e8a", # Відкритий хеш архіву 2024
    "process.env.",
    "os.getenv",
    "env.",
]

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".gz",
    ".tar", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".xml",
}


def is_binary(filepath: str) -> bool:
    _, ext = os.path.splitext(filepath.lower())
    return ext in BINARY_EXTENSIONS


def is_safe_line(line: str) -> bool:
    line_lower = line.lower()
    return any(p in line_lower for p in SAFE_PLACEHOLDERS)


def scan_file_content(filepath: str) -> list:
    """Сканує окремий файл на наявність підозрілих патернів."""
    findings = []
    if not os.path.exists(filepath) or is_binary(filepath):
        return findings

    basename = os.path.basename(filepath)
    if basename in ALLOWED_FILENAMES:
        return findings

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, 1):
                if is_safe_line(line):
                    continue

                for desc, pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        preview = line.strip()
                        if len(preview) > 100:
                            preview = preview[:97] + "..."
                        findings.append({
                            "file": filepath,
                            "line_no": line_no,
                            "type": desc,
                            "preview": preview,
                        })
    except Exception:
        pass

    return findings


def get_staged_files() -> list:
    """Отримує список файлів, доданих до Git Stage (перед комітом)."""
    try:
        out = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            text=True,
            errors="ignore",
        )
        return [f.strip() for f in out.splitlines() if f.strip()]
    except Exception:
        return []


def get_all_tracked_files() -> list:
    """Отримує всі файли, які відстежуються в репозиторії Git, плюс неігноровані нові/змінені файли."""
    files = set()
    try:
        out = subprocess.check_output(["git", "ls-files"], text=True, errors="ignore")
        files.update(f.strip() for f in out.splitlines() if f.strip())
    except Exception:
        pass
    try:
        out = subprocess.check_output(["git", "status", "--porcelain"], text=True, errors="ignore")
        for line in out.splitlines():
            line = line.strip()
            if line:
                parts = line.split(maxsplit=1)
                if len(parts) == 2:
                    clean_name = parts[1].strip().strip('"')
                    if os.path.isfile(clean_name):
                        files.add(clean_name)
    except Exception:
        pass
    return sorted(list(files))


def main():
    parser = argparse.ArgumentParser(description="FinZvit Secret Leak Detector")
    parser.add_argument("--staged", action="store_true", help="Перевіряти тільки staged-файли (для Git pre-commit hook)")
    args = parser.parse_args()

    print(f"{BLUE}🔒 Запуск сканера безпеки на витік токенів, ключів та конфіденційних даних...{NC}")

    if args.staged:
        files = get_staged_files()
        mode_desc = f"staged-файлів ({len(files)})"
    else:
        files = get_all_tracked_files()
        mode_desc = f"відстежуваних файлів репозиторію ({len(files)})"

    if not files:
        print(f"{GREEN}✓ Немає файлів для перевірки.{NC}")
        return 0

    violations = []

    # 1. Перевірка імен файлів
    for f in files:
        basename = os.path.basename(f)
        if basename in ALLOWED_FILENAMES:
            continue

        for blocked in BLOCKED_FILENAMES:
            if blocked.match(basename):
                violations.append({
                    "file": f,
                    "line_no": "-",
                    "type": "Заборонене ім'я файлу (конфігурація/ключ)",
                    "preview": f"Файл '{f}' містить чутливі дані та не повинен потрапляти в Git!",
                })

    # 2. Перевірка вмісту файлів
    for f in files:
        findings = scan_file_content(f)
        violations.extend(findings)

    # 3. Вивід результатів
    if violations:
        print(f"\n{RED}❌ УВАГА! ВИЯВЛЕНО ПОТЕНЦІЙНИЙ ВИТІК СЕКРЕТНИХ ДАНИХ ({len(violations)} знахідок):{NC}")
        for v in violations:
            print(f"  {YELLOW}{v['file']}:{v['line_no']}{NC} [{RED}{v['type']}{NC}]")
            print(f"    Рядок: {v['preview']}")

        print(f"\n{RED}🛑 СТВОРЕННЯ КОМІТУ ЗАБЛОКОВАНО З МІРКУВАНЬ БЕЗПЕКИ.{NC}")
        print("  1. Видаліть секретні ключі або замістіть їх викликом змінних оточення (наприклад, os.getenv / process.env).")
        print("  2. Якщо це локальний файл .env, додайте його до .gitignore.")
        print("  3. Якщо ключ потрапив випадково — обов'язково виконайте його ротацію (зміну) у сервісі (Cloudflare / Supabase)!\n")
        return 1

    print(f"{GREEN}✓ Перевірено {mode_desc}. Жодних токенів, приватних ключів чи .env файлів не виявлено!{NC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
