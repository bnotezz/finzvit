-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000002_ultra_lean_companies.sql
-- Оптимізація розміру бази даних під ліміти безкоштовного тарифу Supabase (500 MB)
-- Зменшує розмір бази з 553 MB до ~40 MB (економія 85% диска)
-- ==============================================================================

-- 0. Видаляємо застарілу функцію пакетного апсерту, оскільки схема колонок оптимізована
DROP FUNCTION IF EXISTS public.upsert_company_batch(JSONB);

-- 1. Видаляємо важкий згенерований стовпчик fts_document та його GIN індекс (~220 MB)
DROP INDEX IF EXISTS public.idx_companies_fts;
ALTER TABLE public.companies DROP COLUMN IF EXISTS fts_document;

-- 2. Видаляємо непотрібні для пошуку важкі колонки (~250 MB)
-- Вся детальна інформація (адреса, повний КВЕД, форми, працівники) 
-- зберігається та миттєво віддається з єдиного JSON-файлу в R2 (/data/2025/{edrpou}.json)
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS available_forms,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS territory,
DROP COLUMN IF EXISTS opf_code,
DROP COLUMN IF EXISTS opf_name,
DROP COLUMN IF EXISTS kved_name,
DROP COLUMN IF EXISTS employees,
DROP COLUMN IF EXISTS accounting_standard,
DROP COLUMN IF EXISTS updated_at;

-- 3. Залишаємо виключно мінімальну компактну структуру для пошуку (лише ~70 байт на рядок)
ALTER TABLE public.companies
ALTER COLUMN edrpou TYPE VARCHAR(10),
ALTER COLUMN name TYPE TEXT,
ALTER COLUMN kved TYPE VARCHAR(10),
ALTER COLUMN year TYPE SMALLINT;

-- 4. Оптимізовані легкі індекси:
--  - Префіксний індекс для миттєвого пошуку за першими цифрами ЄДРПОУ (10 MB)
--  - Триграмний індекс pg_trgm для швидкого нечіткого пошуку за назвою компанії (30 MB)
DROP INDEX IF EXISTS public.idx_companies_edrpou_prefix;
CREATE INDEX IF NOT EXISTS idx_companies_edrpou ON public.companies (edrpou varchar_pattern_ops);

DROP INDEX IF EXISTS public.idx_companies_name_trgm;
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON public.companies USING gin (name gin_trgm_ops);

-- 5. Оновлюємо пошукову RPC функцію
-- УВАГА: Оскільки тип рядка повернення (OUT параметри / RETURNS TABLE) змінився, 
-- PostgreSQL вимагає явного DROP FUNCTION перед створенням нової функції.
DROP FUNCTION IF EXISTS public.search_companies(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.search_companies(
    search_query TEXT,
    lim INTEGER DEFAULT 10
)
RETURNS TABLE (
    edrpou VARCHAR(10),
    name TEXT,
    kved VARCHAR(10),
    similarity REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleaned_query TEXT;
    is_numeric BOOLEAN;
BEGIN
    cleaned_query := trim(search_query);
    
    IF cleaned_query = '' OR cleaned_query IS NULL THEN
        RETURN;
    END IF;

    -- Пошук за кодом ЄДРПОУ
    is_numeric := cleaned_query ~ '^[0-9]+$';

    IF is_numeric THEN
        RETURN QUERY
        SELECT 
            c.edrpou,
            c.name,
            c.kved,
            1.0::REAL AS similarity
        FROM public.companies c
        WHERE c.edrpou LIKE cleaned_query || '%'
        ORDER BY c.edrpou ASC
        LIMIT lim;
    ELSE
        -- Пошук за назвою підприємства через триграми
        RETURN QUERY
        SELECT 
            c.edrpou,
            c.name,
            c.kved,
            similarity(c.name, cleaned_query)::REAL AS similarity
        FROM public.companies c
        WHERE 
            c.name ILIKE '%' || cleaned_query || '%'
            OR c.name % cleaned_query
        ORDER BY 
            similarity(c.name, cleaned_query) DESC,
            length(c.name) ASC
        LIMIT lim;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;

-- Примітка щодо VACUUM FULL:
-- Команда VACUUM не може виконуватись всередині транзакційного блоку міграції (BEGIN...COMMIT).
-- За потреби звільнення місця на диску виконайте `VACUUM FULL public.companies;` вручну в SQL Editor у кабінеті Supabase.
