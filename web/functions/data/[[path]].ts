interface Env {
  R2_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pathParts = context.params.path;
  const path = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;

  if (!path) {
    return new Response(JSON.stringify({ error: 'Шлях до файлу не вказано' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Якщо прив'язка R2_BUCKET відсутня (наприклад, у локальному режимі без R2)
  if (!context.env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: 'R2_BUCKET binding не налаштовано в Cloudflare Pages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Отримуємо об'єкт безпосередньо з приватного бакета R2 через внутрішній біндінг
    const object = await context.env.R2_BUCKET.get(path);

    if (!object) {
      return new Response(JSON.stringify({ error: `Звіт ${path} не знайдено у сховищі R2` }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 2. Встановлюємо метадані та агресивні заголовки кешування для Cloudflare Edge CDN
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Access-Control-Allow-Origin', '*');

    // КЕШУВАННЯ НА 1 РІК на серверах Cloudflare Edge:
    // Перший запит завантажує файл з R2, а всі наступні відвідувачі
    // отримують його миттєво з Edge-кешу БЕЗ звернення до R2 (0$ за операції).
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Помилка читання з R2' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
