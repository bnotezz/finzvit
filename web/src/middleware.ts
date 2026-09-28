import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Підтримка динамічних маршрутів /company/:edrpou в локальному режимі розробки (astro dev)
  if (url.pathname.startsWith('/company/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const edrpou = parts[1];

    // Якщо відкрито динамічний маршрут компанії — внутрішній rewrite на універсальну сторінку-оболонку /company,
    // зберігаючи оригінальний URL у браузері для клієнтської гідрації даних з API
    if (edrpou) {
      return context.rewrite('/company');
    }
  }

  return next();
});
