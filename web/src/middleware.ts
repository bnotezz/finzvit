import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Підтримка динамічних маршрутів /company/:edrpou в локальному режимі розробки
  if (url.pathname.startsWith('/company/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const edrpou = parts[1];
    
    // Якщо ЄДРПОУ не входить до статично задекларованих зразків:
    if (edrpou && !['32673400', '31316718', '00290771'].includes(edrpou)) {
      // Використовуємо внутрішній rewrite на універсальну сторінку компанії,
      // зберігаючи оригінальний URL у браузері для клієнтської гідрації
      return context.rewrite('/company/32673400');
    }
  }

  return next();
});
