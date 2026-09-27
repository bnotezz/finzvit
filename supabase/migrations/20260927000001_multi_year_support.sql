-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000001_multi_year_support.sql
-- Підтримка множинних років та захист від перезапису новими даними старіших років
-- ==============================================================================

-- 1. Додавання стовпчиків для збереження всіх доступних років
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS available_years SMALLINT[] DEFAULT ARRAY[2025]::SMALLINT[],
ADD COLUMN IF NOT EXISTS latest_year SMALLINT DEFAULT 2025;

-- 2. Оновлення існуючих записів
UPDATE public.companies 
SET available_years = ARRAY[year]::SMALLINT[],
    latest_year = year
WHERE available_years IS NULL OR array_length(available_years, 1) IS NULL;

-- 3. Створення оптимізованої RPC-функції пакетного апсерту компаній
-- Гарантує:
--  - актуальні реквізити (назва, адреса тощо) НЕ перетираються старішими роками
--  - список available_years накопичує всі роки (наприклад [2024, 2025])
CREATE OR REPLACE FUNCTION public.upsert_company_batch(companies_data JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.companies (
        edrpou,
        name,
        kved,
        kved_name,
        address,
        territory,
        opf_code,
        opf_name,
        employees,
        accounting_standard,
        available_forms,
        year,
        latest_year,
        available_years,
        updated_at
    )
    SELECT
        item->>'edrpou',
        item->>'name',
        item->>'kved',
        item->>'kved_name',
        item->>'address',
        item->>'territory',
        item->>'opf_code',
        item->>'opf_name',
        NULLIF(item->>'employees', '')::integer,
        item->>'accounting_standard',
        COALESCE(item->'available_forms', '[]'::jsonb),
        COALESCE(NULLIF(item->>'year', '')::smallint, 2025),
        COALESCE(NULLIF(item->>'year', '')::smallint, 2025),
        ARRAY[COALESCE(NULLIF(item->>'year', '')::smallint, 2025)],
        NOW()
    FROM jsonb_array_elements(companies_data) AS item
    ON CONFLICT (edrpou) DO UPDATE SET
        name = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.name ELSE companies.name END,
        kved = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.kved ELSE companies.kved END,
        kved_name = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.kved_name ELSE companies.kved_name END,
        address = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.address ELSE companies.address END,
        territory = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.territory ELSE companies.territory END,
        opf_code = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.opf_code ELSE companies.opf_code END,
        opf_name = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.opf_name ELSE companies.opf_name END,
        employees = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.employees ELSE companies.employees END,
        accounting_standard = CASE WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.accounting_standard ELSE companies.accounting_standard END,
        
        latest_year = GREATEST(companies.latest_year, EXCLUDED.latest_year),
        year = GREATEST(companies.year, EXCLUDED.year),
        
        available_years = (
            SELECT ARRAY_AGG(DISTINCT y ORDER BY y DESC)
            FROM unnest(companies.available_years || EXCLUDED.available_years) AS y
        ),
        
        available_forms = CASE 
            WHEN EXCLUDED.latest_year >= companies.latest_year THEN EXCLUDED.available_forms 
            ELSE companies.available_forms 
        END,
        
        updated_at = NOW();
END;
$$;
