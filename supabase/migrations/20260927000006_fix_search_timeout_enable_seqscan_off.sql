-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000006_fix_search_timeout_enable_seqscan_off.sql
-- Дата створення: 2026-09-29
-- Опис: Усунення помилки statement timeout (SQLSTATE 57014) у search_companies.
--       Примусове відключення послідовного сканування (SET enable_seqscan = off)
--       для гарантованого використання GIN-триграмного індексу idx_companies_name_trgm,
--       використання MATERIALIZED CTE для ізоляції пошуку та швидка обробка префіксів.
-- ==============================================================================

-- 1. Переконуємось у наявності розширень та актуального GIN-триграмного індексу
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_companies_name_trgm 
ON public.companies USING gin (name gin_trgm_ops);

-- 2. Оновлення пошукової функції з оптимізацією планувальника PostgreSQL
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

    -- 2.1. Пошук за кодом або префіксом ЄДРПОУ (використовує B-tree Primary Key)
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
            -- Точний збіг повного коду завжди на 1 місці
            CASE WHEN c.edrpou = cleaned_query THEN 1 ELSE 0 END DESC,
            c.weight DESC,
            c.edrpou ASC
        LIMIT lim;
    ELSE
        -- 2.2. Пошук за назвою через GIN-триграмний індекс
        -- SET enable_seqscan = off гарантує, що планувальник PostgreSQL ЗАВЖДИ
        -- обирає Bitmap Index Scan по idx_companies_name_trgm і не падає у повільний
        -- Sequential Scan на 435,000+ рядків через наявність LIMIT 50.
        -- MATERIALIZED запобігає небажаному inlining підзапиту планувальником.
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

-- Надання прав на виклик
GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;
