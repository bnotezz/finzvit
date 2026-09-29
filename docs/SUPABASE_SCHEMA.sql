-- ==============================================================================
-- FinZvit Supabase Database Schema
-- Реєстр компаній та оптимізований повнотекстовий/триграмний пошук
-- ==============================================================================

-- 1. Увімкнення розширень для пошуку
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Створення ультра-компактної таблиці компаній (лише ~74 байти на рядок)
-- Усі важкі деталі (адреси, форми, звіти) зберігаються у Cloudflare R2
CREATE TABLE IF NOT EXISTS public.companies (
    edrpou VARCHAR(10) COLLATE "C" PRIMARY KEY,
    name TEXT NOT NULL,
    kved VARCHAR(10),
    year SMALLINT DEFAULT 2025,
    weight INTEGER DEFAULT 0
);

-- 3. Налаштування мінімальних індексів (жодного зайвого дублювання):
--  - Primary key `companies_pkey` завдяки COLLATE "C" напряму обслуговує префіксний пошук (LIKE '123%')
--  - Триграмний GIN-індекс для блискавичного пошуку за назвою через ILIKE (5-15 мс)
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm 
ON public.companies USING gin (name gin_trgm_ops);

-- 4. Налаштування Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Публічний доступ тільки на читання для всіх відвідувачів
DROP POLICY IF EXISTS "Public read access for companies" ON public.companies;
CREATE POLICY "Public read access for companies"
ON public.companies
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Тригер захисту даних найсвіжішого року від перезапису старішими періодами
CREATE OR REPLACE FUNCTION public.protect_company_latest_data()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.year IS NOT NULL AND NEW.year < OLD.year THEN
        NEW.name := OLD.name;
        NEW.kved := COALESCE(OLD.kved, NEW.kved);
        NEW.year := OLD.year;
        IF OLD.weight IS NOT NULL AND OLD.weight > 0 THEN
            NEW.weight := OLD.weight;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_company_latest_data ON public.companies;
CREATE TRIGGER trg_protect_company_latest_data
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.protect_company_latest_data();

-- 6. RPC функція для автокомпліту та ранжованого пошуку
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
SET enable_seqscan = off
AS $$
DECLARE
    cleaned_query TEXT;
    is_numeric BOOLEAN;
BEGIN
    cleaned_query := trim(search_query);
    
    IF cleaned_query = '' OR cleaned_query IS NULL THEN
        RETURN;
    END IF;

    -- 6.1. Пошук за кодом ЄДРПОУ
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
        ORDER BY 
            CASE WHEN c.edrpou = cleaned_query THEN 1 ELSE 0 END DESC,
            c.weight DESC,
            c.edrpou ASC
        LIMIT lim;
    ELSE
        -- 6.2. Швидкий пошук за назвою через GIN-триграмний індекс
        -- SET enable_seqscan = off гарантує використання Bitmap Index Scan (GIN)
        -- і запобігає падінню у повільний Sequential Scan на великих масивах.
        RETURN QUERY
        WITH matched AS MATERIALIZED (
            SELECT 
                c.edrpou,
                c.name,
                c.kved,
                c.weight,
                similarity(c.name, cleaned_query)::REAL AS sim
            FROM public.companies c
            WHERE c.name ILIKE ('%' || cleaned_query || '%')
            LIMIT 50
        )
        SELECT 
            m.edrpou,
            m.name,
            m.kved,
            m.sim AS similarity
        FROM matched m
        ORDER BY 
            round(m.sim::numeric, 2) DESC,
            m.weight DESC,
            length(m.name) ASC
        LIMIT lim;
    END IF;
END;
$$;

-- Надання прав на виклик функції
GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;

-- ==============================================================================
-- 7. Журнал імпортованих датасетів та ресурсів (data.gov.ua)
-- Фіксує версії завантажених архівів, MD5-хеші, дати оновлення та статистику
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.imported_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id VARCHAR(64),
    dataset_id VARCHAR(64),
    name TEXT NOT NULL,
    year SMALLINT NOT NULL DEFAULT 2025,
    url TEXT,
    file_name TEXT,
    file_hash VARCHAR(64),
    remote_updated_at TIMESTAMP WITH TIME ZONE,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    companies_count INTEGER DEFAULT 0,
    forms_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_imported_datasets_resource_id ON public.imported_datasets (resource_id);
CREATE INDEX IF NOT EXISTS idx_imported_datasets_year ON public.imported_datasets (year);
CREATE INDEX IF NOT EXISTS idx_imported_datasets_file_hash ON public.imported_datasets (file_hash);

ALTER TABLE public.imported_datasets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for imported_datasets" ON public.imported_datasets;
CREATE POLICY "Public read access for imported_datasets"
ON public.imported_datasets
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service role full access for imported_datasets" ON public.imported_datasets;
CREATE POLICY "Service role full access for imported_datasets"
ON public.imported_datasets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

