-- ==============================================================================
-- FinZvit Supabase Database Schema
-- Реєстр компаній та оптимізований повнотекстовий/триграмний пошук
-- ==============================================================================

-- 1. Увімкнення розширень для пошуку
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Створення ультра-компактної таблиці компаній (лише ~70 байт на рядок)
-- Усі важкі деталі (адреси, форми, звіти) зберігаються у Cloudflare R2
CREATE TABLE IF NOT EXISTS public.companies (
    edrpou VARCHAR(10) COLLATE "C" PRIMARY KEY,
    name TEXT NOT NULL,
    kved VARCHAR(10),
    year SMALLINT DEFAULT 2025
);

-- 3. Налаштування мінімальних індексів (жодного зайвого дублювання):
--  - Primary key `companies_pkey` завдяки COLLATE "C" напряму обслуговує префіксний пошук (LIKE '123%')
--  - Триграмний GiST-індекс для нечіткого швидкого пошуку за назвою (займає ~35 MB замість 105 MB у GIN)
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm 
ON public.companies USING gist (name gist_trgm_ops);

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

    -- Перевіряємо, чи запит складається тільки з цифр (код ЄДРПОУ)
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

-- Надання прав на виклик функції
GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;
