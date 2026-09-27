-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000003_fast_gin_search.sql
-- Перехід на високошвидкісний GIN-триграмний індекс та оптимізація функції search_companies
-- ==============================================================================

-- 1. Переконуємось, що розширення pg_trgm увімкнено
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Створюємо GIN триграмний індекс на назву компанії
-- GIN забезпечує виконання ILIKE '%запит%' за 5-15 мс без таймаутів
DROP INDEX IF EXISTS public.idx_companies_name_trgm;
CREATE INDEX idx_companies_name_trgm ON public.companies USING gin (name gin_trgm_ops);

-- 3. Оновлюємо пошукову функцію з оптимізованим лімітованим CTE
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

    -- Пошук за кодом ЄДРПОУ (використовує первинний B-tree ключ)
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
        -- Швидкий пошук за назвою через GIN-триграмний індекс з лімітом підзапиту 50
        RETURN QUERY
        WITH matched AS (
            SELECT 
                c.edrpou,
                c.name,
                c.kved
            FROM public.companies c
            WHERE c.name ILIKE ('%' || cleaned_query || '%')
            LIMIT 50
        )
        SELECT 
            m.edrpou,
            m.name,
            m.kved,
            similarity(m.name, cleaned_query)::REAL AS similarity
        FROM matched m
        ORDER BY 
            similarity(m.name, cleaned_query) DESC,
            length(m.name) ASC
        LIMIT lim;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;
