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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const CACHE_VERSION = 'v3';

// Список офіційно підтримуваних років у сховищі R2 (у порядку від найновішого)
export const SUPPORTED_YEARS = [2025, 2024] as const;
export type SupportedYear = typeof SUPPORTED_YEARS[number];

/**
 * Перевіряє наявність звітності для конкретного року через легкий HEAD-запит (< 1 мс).
 */
export async function checkCompanyYearAvailable(edrpou: string, year: number): Promise<boolean> {
  const url = `${R2_PUBLIC_URL}/${year}/${edrpou}.json?v=${CACHE_VERSION}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Перевіряє всі підтримувані роки для компанії паралельно та повертає список наявних років.
 */
export async function checkAvailableYears(edrpou: string): Promise<number[]> {
  const results = await Promise.all(
    SUPPORTED_YEARS.map(async (y) => {
      const ok = await checkCompanyYearAvailable(edrpou, y);
      return { year: y, ok };
    })
  );
  const found = results.filter((r) => r.ok).map((r) => r.year);
  return found.length > 0 ? found : [SUPPORTED_YEARS[0]];
}

/**
 * Завантажує єдиний повний документ компанії зі всіма її звітами та реквізитами (/{year}/{edrpou}.json)
 * Забезпечує завантаження всієї фінансової звітності за 1 надшвидкий мережевий запит.
 */
export async function fetchCompanyData(edrpou: string, year: number = SUPPORTED_YEARS[0]): Promise<CompanyFullData> {
  const url = `${R2_PUBLIC_URL}/${year}/${edrpou}.json?v=${CACHE_VERSION}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(`Для підприємства з кодом ЄДРПОУ «${edrpou}» відсутня подана фінансова звітність за ${year} рік у відкритому реєстрі.`, 404);
    }
    throw new ApiError(`Помилка сервера (${res.status}): не вдалося завантажити звітність.`, res.status);
  }
  try {
    return await res.json();
  } catch (err: any) {
    throw new ApiError(`Помилка обробки формату даних звітності (${err?.message || 'некоректний JSON'})`, 500);
  }
}
