import { supabase } from './supabase';
import type { CompanyMeta, ReportData, CompanySearchResult, CompanyFullData } from './types';

// Базовий URL сховища звітів (Cloudflare R2 або локальний fallback /data/)
const R2_PUBLIC_URL = import.meta.env.PUBLIC_R2_URL || '/data';

/**
 * Швидкий пошук компаній:
 * 1. Якщо налаштовано Supabase — через RPC search_companies.
 * 2. Інакше fallback на локальний реєстр /data/companies_registry.json.
 */
export async function searchCompanies(query: string, limit = 8): Promise<CompanySearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  // Спробуємо через Supabase RPC
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('search_companies', {
        search_query: clean,
        lim: limit,
      });

      if (!error && data && Array.isArray(data)) {
        return data as CompanySearchResult[];
      }
    } catch (err) {
      console.warn('Помилка пошуку через Supabase, перемикаємось на fallback:', err);
    }
  }

  // Fallback: локальний реєстр
  try {
    const res = await fetch('/data/companies_registry.json');
    if (!res.ok) return [];
    const companies: CompanySearchResult[] = await res.json();

    const isNumeric = /^\d+$/.test(clean);
    return companies
      .filter((c) => {
        if (isNumeric) {
          return c.edrpou.startsWith(clean);
        }
        return c.name.toLowerCase().includes(clean.toLowerCase());
      })
      .slice(0, limit);
  } catch (err) {
    console.error('Не вдалося завантажити реєстр:', err);
    return [];
  }
}

/**
 * Завантажує єдиний повний документ компанії зі всіма її звітами та реквізитами (/{year}/{edrpou}.json)
 * Забезпечує завантаження всієї фінансової звітності за 1 надшвидкий мережевий запит.
 */
export async function fetchCompanyData(edrpou: string, year = 2025): Promise<CompanyFullData> {
  const url = `${R2_PUBLIC_URL}/${year}/${edrpou}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    // Fallback: якщо єдиного файлу немає, спробувати завантажити legacy meta.json
    try {
      const meta = await fetchCompanyMeta(edrpou, year);
      return {
        ...meta,
        reports: {},
      };
    } catch {
      throw new Error(`Компанію з ЄДРПОУ ${edrpou} не знайдено або звітність за ${year} рік відсутня.`);
    }
  }
  return res.json();
}

/**
 * Завантажує зведені метадані компанії (meta.json)
 */
export async function fetchCompanyMeta(edrpou: string, year = 2025): Promise<CompanyMeta> {
  const url = `${R2_PUBLIC_URL}/${year}/${edrpou}/meta.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Компанію з ЄДРПОУ ${edrpou} не знайдено або звітність за ${year} рік відсутня.`);
  }
  return res.json();
}

/**
 * Завантажує дані конкретної форми ({formCode}.json)
 */
export async function fetchReportData(
  edrpou: string,
  formCode: string,
  year = 2025
): Promise<ReportData> {
  const url = `${R2_PUBLIC_URL}/${year}/${edrpou}/${formCode}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Звіт форми ${formCode} для компанії ${edrpou} не знайдено.`);
  }
  return res.json();
}
