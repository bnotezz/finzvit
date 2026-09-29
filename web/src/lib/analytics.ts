// web/src/lib/analytics.ts
// Клієнтський модуль аналітики для Google Analytics 4 (GA4)

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Фіксує подію перегляду компанії в Google Analytics 4.
 * Використовує параметри edrpou, company_name, kved, year для побудови звітів популярності в Looker Studio.
 * Не викликає жодних серверних запитів до Cloudflare Worker або Supabase.
 */
export function trackCompanyView(
  edrpou: string,
  companyName: string,
  kved?: string,
  year?: number
): void {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'view_company', {
      edrpou: String(edrpou).trim(),
      company_name: companyName,
      kved: kved || '',
      year: year || 2025,
    });
  }
}