import { supabase } from './supabase';
import type { CompanySearchResult, CompanyFullData } from './types';

// Базовий URL сховища звітів (Cloudflare R2 або локальний fallback /data/)
const R2_PUBLIC_URL = import.meta.env.PUBLIC_R2_URL || '/data';

/**
 * Швидкий пошук компаній через Supabase RPC search_companies.
 * Використовує триграмні індекси (pg_trgm) для миттєвого автокомпліту (< 15ms).
 */
export async function searchCompanies(query: string, limit = 8): Promise<CompanySearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  if (!supabase) {
    console.error('Клієнт Supabase не ініціалізовано. Перевірте змінні середовища PUBLIC_SUPABASE_URL та PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('search_companies', {
      search_query: clean,
      lim: limit,
    });

    if (error) {
      console.error('Помилка пошуку через Supabase RPC search_companies:', error.message || error);
      return [];
    }

    if (data && Array.isArray(data)) {
      return data as CompanySearchResult[];
    }
    return [];
  } catch (err) {
    console.error('Мережева помилка пошуку через Supabase:', err);
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
    throw new Error(`Компанію з ЄДРПОУ ${edrpou} не знайдено або звітність за ${year} рік відсутня.`);
  }
  return res.json();
}
