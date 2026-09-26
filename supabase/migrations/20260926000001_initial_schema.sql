-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260926000001_initial_schema.sql
-- Реєстр компаній та оптимізований повнотекстовий/триграмний пошук
-- ==============================================================================

-- 1. Увімкнення розширень для пошуку
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Створення таблиці компаній
CREATE TABLE IF NOT EXISTS public.companies (
    edrpou VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    kved VARCHAR(10),
    kved_name TEXT,
    address TEXT,
    territory TEXT,
    opf_code VARCHAR(10),
    opf_name TEXT,
    employees INTEGER,
    accounting_standard TEXT,
    available_forms JSONB DEFAULT '[]'::jsonb,
    year SMALLINT DEFAULT 2025,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Налаштування індексів для миттєвого пошуку
-- Префіксний пошук за кодом ЄДРПОУ
CREATE INDEX IF NOT EXISTS idx_companies_edrpou_prefix 
ON public.companies (edrpou varchar_pattern_ops);

-- Триграмний індекс для нечіткого / швидкого пошуку за назвою компанії
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm 
ON public.companies USING gin (name gin_trgm_ops);

-- Повнотекстовий індекс (FTS)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fts_document tsvector
GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(edrpou, '') || ' ' || coalesce(name, '') || ' ' || coalesce(kved, ''))
) STORED;

CREATE INDEX IF NOT EXISTS idx_companies_fts 
ON public.companies USING gin (fts_document);

-- 4. Налаштування Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Публічний доступ тільки на читання для всіх відвідувачів
DROP POLICY IF EXISTS "Public read access for companies" ON public.companies;
CREATE POLICY "Public read access for companies"
ON public.companies
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. RPC функція для автокомпліту та пошуку
-- Працює як для коду ЄДРПОУ (числа), так і для текстової назви підприємства
CREATE OR REPLACE FUNCTION public.search_companies(
    search_query TEXT,
    lim INTEGER DEFAULT 10
)
RETURNS TABLE (
    edrpou VARCHAR(10),
    name TEXT,
    kved VARCHAR(10),
    kved_name TEXT,
    address TEXT,
    available_forms JSONB,
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

    -- Перевіряємо, чи запит складається тільки з цифр (код ЄДРПОУ)
    is_numeric := cleaned_query ~ '^[0-9]+$';

    IF is_numeric THEN
        RETURN QUERY
        SELECT 
            c.edrpou,
            c.name,
            c.kved,
            c.kved_name,
            c.address,
            c.available_forms,
            1.0::REAL AS similarity
        FROM public.companies c
        WHERE c.edrpou LIKE cleaned_query || '%'
        ORDER BY c.edrpou ASC
        LIMIT lim;
    ELSE
        RETURN QUERY
        SELECT 
            c.edrpou,
            c.name,
            c.kved,
            c.kved_name,
            c.address,
            c.available_forms,
            similarity(c.name, cleaned_query)::REAL AS similarity
        FROM public.companies c
        WHERE 
            c.name ILIKE '%' || cleaned_query || '%'
            OR c.fts_document @@ plainto_tsquery('simple', cleaned_query)
        ORDER BY 
            similarity(c.name, cleaned_query) DESC,
            length(c.name) ASC
        LIMIT lim;
    END IF;
END;
$$;

-- Надання прав на виклик функції
GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;
