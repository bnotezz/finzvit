#!/usr/bin/env python3
"""
FinZvit Cloudflare Cache Purge Tool
Скрипт для точкового або глобального очищення кешу Cloudflare (Edge CDN)
коли оновлюються дані в Cloudflare R2.

Використання:
    # 1. Точкове очищення кешу конкретної компанії за тегом:
    python3 scripts/purge_cache.py --edrpou 32673400

    # 2. Очищення кешу кількох компаній:
    python3 scripts/purge_cache.py --edrpou 32673400,31316718

    # 3. Очищення за роком:
    python3 scripts/purge_cache.py --year 2025

    # 4. Повне глобальне очищення кешу зони:
    python3 scripts/purge_cache.py --all
"""

import os
import sys
import argparse
import json
import urllib.request
import urllib.error
from pathlib import Path

def load_env_local():
    """Завантажує змінні з .env.local якщо вони не задані в системі."""
    env_file = Path(__file__).resolve().parent.parent / "web" / ".env.local"
    if not env_file.exists():
        env_file = Path(__file__).resolve().parent.parent / ".env.local"
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

def purge_cache(zone_id: str, api_token: str, payload: dict) -> bool:
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "User-Agent": "FinZvit-Purge-Tool/1.0",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            res = json.loads(body)
            if res.get("success"):
                print("✅ Кеш успішно інвалідовано в Cloudflare!")
                return True
            else:
                print(f"❌ Помилка Cloudflare API: {res.get('errors')}")
                return False
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8") if e.fp else str(e)
        print(f"❌ HTTP {e.code} помилка при очищенні кешу: {err_msg}")
        return False
    except Exception as e:
        print(f"❌ Помилка з'єднання: {e}")
        return False

def main():
    load_env_local()

    parser = argparse.ArgumentParser(description="FinZvit Cloudflare Cache Purge Tool")
    parser.add_argument("--edrpou", help="Код ЄДРПОУ (або кілька через кому) для точкового очищення за Cache-Tag")
    parser.add_argument("--year", help="Рік звітності для очищення за Cache-Tag (напр. 2025)")
    parser.add_argument("--all", action="store_true", help="Повне очищення кешу всієї зони (Purge Everything)")
    args = parser.parse_args()

    zone_id = os.environ.get("CLOUDFLARE_ZONE_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")

    if not zone_id or not api_token:
        print("⚠️ УВАГА: Не знайдено CLOUDFLARE_ZONE_ID або CLOUDFLARE_API_TOKEN.")
        print("Вкажіть їх у змінних середовища або додайте у .env.local:")
        print("  CLOUDFLARE_ZONE_ID=ваш_zone_id")
        print("  CLOUDFLARE_API_TOKEN=ваш_api_token_з_правами_Cache_Purge")
        sys.exit(1)

    if args.all:
        print(f"🔄 Запуск глобального очищення кешу для зони {zone_id}...")
        success = purge_cache(zone_id, api_token, {"purge_everything": True})
        sys.exit(0 if success else 1)

    tags = []
    if args.edrpou:
        for ed in args.edrpou.split(","):
            ed = ed.strip()
            if ed:
                tags.append(f"company-{ed}")
    if args.year:
        tags.append(f"year-{args.year.strip()}")

    if not tags:
        print("Вкажіть параметр --edrpou <код>, --year <рік> або --all.")
        parser.print_help()
        sys.exit(1)

    print(f"🔄 Скидання кешу Cloudflare за тегами: {tags}...")
    success = purge_cache(zone_id, api_token, {"tags": tags})
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
