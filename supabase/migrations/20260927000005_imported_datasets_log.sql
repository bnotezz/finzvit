-- ==============================================================================
-- FinZvit Supabase Database Migration
-- 20260927000005_imported_datasets_log.sql
-- Дата створення: 2026-09-28 20:14:30
-- Опис: Створення таблиці журналу імпортованих датасетів та ресурсів (data.gov.ua),
--       включаючи ідентифікатор ресурсу, хеш-суму файлу, дату оновлення та кількість записів.
-- ==============================================================================

-- 1. Створення таблиці журналу імпортованих датасетів
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

-- 2. Індекси для швидкого пошуку та перевірки дублікатів
CREATE INDEX IF NOT EXISTS idx_imported_datasets_resource_id ON public.imported_datasets (resource_id);
CREATE INDEX IF NOT EXISTS idx_imported_datasets_year ON public.imported_datasets (year);
CREATE INDEX IF NOT EXISTS idx_imported_datasets_file_hash ON public.imported_datasets (file_hash);

-- 3. Налаштування Row Level Security (RLS)
ALTER TABLE public.imported_datasets ENABLE ROW LEVEL SECURITY;

-- Публічний доступ тільки на читання для всіх відвідувачів (anon, authenticated)
DROP POLICY IF EXISTS "Public read access for imported_datasets" ON public.imported_datasets;
CREATE POLICY "Public read access for imported_datasets"
ON public.imported_datasets
FOR SELECT
TO anon, authenticated
USING (true);

-- Повний доступ на запис/оновлення для службового ключа (service_role)
DROP POLICY IF EXISTS "Service role full access for imported_datasets" ON public.imported_datasets;
CREATE POLICY "Service role full access for imported_datasets"
ON public.imported_datasets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Запис початкового історичного ресурсу (data.gov.ua 2025 рік)
INSERT INTO public.imported_datasets (
    resource_id,
    dataset_id,
    name,
    year,
    url,
    file_name,
    file_hash,
    remote_updated_at,
    imported_at,
    status,
    details
)
VALUES (
    'fe3f6731-8a79-463b-b3af-03811d7a0e26',
    '7436ae83-dfc1-4836-9962-8af3e831c522',
    'Фінансова звітність підприємств за 2025 рік (подана у період з 2026-01-01 по 2026-09-07)',
    2025,
    'https://data.gov.ua/dataset/6456ef0c-985c-4bb7-bf9d-16831161b416/resource/fe3f6731-8a79-463b-b3af-03811d7a0e26/download/fin_zvit_2025_ric_-2026-01-01_2026-09-07.zip',
    'fin_zvit_2025_ric_-2026-01-01_2026-09-07.zip',
    '127849138586737fd0c1fcb9f0ac9034',
    '2026-09-09 00:34:00+03:00'::timestamptz,
    NOW(),
    'completed',
    jsonb_build_object(
        'portal', 'data.gov.ua',
        'source', 'Державна служба статистики України',
        'sub_archives_count', 6
    )
);
