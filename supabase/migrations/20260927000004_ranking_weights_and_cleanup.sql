-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000004_ranking_weights_and_cleanup.sql
-- Дата створення: 2026-09-28 19:46:32
-- Опис: Очищення дублюючих колонок років (latest_year, "lastYear", available_years),
--       додавання вагового коефіцієнта масштабу компанії (weight),
--       створення тригера захисту даних найсвіжішого року від затирання старішими періодами,
--       та оновлення функції search_companies для пріоритетного показу великих компаній.
-- ==============================================================================

-- 1. Видалення застарілих дублюючих колонок
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS latest_year,
DROP COLUMN IF EXISTS "lastYear",
DROP COLUMN IF EXISTS available_years;

-- 2. Додавання числового рангу масштабу підприємства (~4 байти на рядок, ~1.7 МБ на всю Україну)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 0;

-- 3. Тригер захисту найсвіжіших даних від перезапису при завантаженні старіших років
-- Гарантує:
--  - Якщо імпортуються дані за старіший рік (NEW.year < OLD.year),
--    актуальна назва, квед, рік та вага залишаються з найсвіжішого періоду.
--  - Якщо в базі вага ще була 0, а у старішому періоді вона є, вага встановлюється.
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

-- 4. Оновлення пошукової функції search_companies з урахуванням ваги підприємства
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

    -- 4.1. Пошук за кодом або префіксом ЄДРПОУ
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
            -- Точний збіг повного коду завжди йде на 1 місці
            CASE WHEN c.edrpou = cleaned_query THEN 1 ELSE 0 END DESC,
            -- При збігу префіксу (наприклад 326...) більші підприємства йдуть першими
            c.weight DESC,
            c.edrpou ASC
        LIMIT lim;
    ELSE
        -- 4.2. Пошук за назвою через GIN-триграмний індекс
        RETURN QUERY
        WITH matched AS (
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
            -- Близькі за точністю збіги сортуються за масштабом підприємства (weight DESC)
            round(m.sim::numeric, 2) DESC,
            m.weight DESC,
            length(m.name) ASC
        LIMIT lim;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_companies(TEXT, INTEGER) TO anon, authenticated;
