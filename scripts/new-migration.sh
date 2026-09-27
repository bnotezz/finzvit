#!/usr/bin/env bash
# ==============================================================================
# FinZvit Migration Generator
# Створює новий імутабельний файл міграції в supabase/migrations/
# Використання: bash scripts/new-migration.sh <назва_міграції>
# ==============================================================================

set -e

if [ -z "$1" ]; then
    echo "❌ Помилка: Вкажіть назву міграції."
    echo "Приклад: bash scripts/new-migration.sh add_revenue_index"
    exit 1
fi

MIGRATION_NAME="$1"
# Очищуємо назву від пробілів та спецсимволів
CLEAN_NAME=$(echo "$MIGRATION_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd 'a-z0-9_')

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
mkdir -p "$MIGRATIONS_DIR"

# Знаходимо останній номер міграції або генеруємо за датою
DATE_PREFIX=$(date +"%Y%m%d")
LAST_FILE=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort | tail -n 1)

if [ -n "$LAST_FILE" ]; then
    LAST_BASE=$(basename "$LAST_FILE" .sql)
    # Спробуємо витягнути 14-значний префікс
    PREFIX_NUM=$(echo "$LAST_BASE" | cut -d'_' -f1)
    if [[ "$PREFIX_NUM" =~ ^[0-9]{14}$ ]]; then
        NEXT_NUM=$(printf "%014d" $((10#$PREFIX_NUM + 1)))
    else
        NEXT_NUM=$(date +"%Y%m%d%H%M%S")
    fi
else
    NEXT_NUM="${DATE_PREFIX}000001"
fi

TARGET_FILE="$MIGRATIONS_DIR/${NEXT_NUM}_${CLEAN_NAME}.sql"

cat <<EOF > "$TARGET_FILE"
-- ==============================================================================
-- FinZvit Supabase Database Migration
-- ${NEXT_NUM}_${CLEAN_NAME}.sql
-- Дата створення: $(date +"%Y-%m-%d %H:%M:%S")
-- Опис: $MIGRATION_NAME
-- ==============================================================================

-- УВАГА:
-- 1. Цей файл є ІМУТАБЕЛЬНИМ. Після застосування ніколи не редагуйте його.
-- 2. Якщо змінюється сигнатура існуючої функції, завжди використовуйте DROP FUNCTION IF EXISTS перед CREATE.
-- 3. Завжди надавайте права доступу: GRANT EXECUTE ... TO anon, authenticated;

-- [Вставте ваш SQL код тут]

EOF

echo "✅ Створено новий файл міграції:"
echo "👉 $TARGET_FILE"
