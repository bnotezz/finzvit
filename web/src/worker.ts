export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  R2_BUCKET?: {
    get: (key: string) => Promise<{
      body: ReadableStream;
      httpEtag: string;
      writeHttpMetadata: (headers: Headers) => void;
      text: () => Promise<string>;
    } | null>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Обробка запитів до фінансових даних (/data/...)
    if (url.pathname.startsWith('/data/')) {
      const key = url.pathname.replace(/^\/data\//, '');
      if (!key) {
        return new Response(JSON.stringify({ error: 'Key not specified' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Перевірка Cloudflare Edge Cache API (HIT)
      const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
      if (cache && request.method === 'GET') {
        try {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            const hitRes = new Response(cachedResponse.body, cachedResponse);
            hitRes.headers.set('X-FinZvit-Cache', 'HIT');
            return hitRes;
          }
        } catch {
          // Ігноруємо помилки кешу для стабільності
        }
      }

      // Якщо R2 бакет не підключено (наприклад локально) — fallback до статичних файлів dist/data
      if (!env.R2_BUCKET) {
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
          return env.ASSETS.fetch(request);
        }
        return new Response(JSON.stringify({ error: 'R2_BUCKET binding missing' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        let finalResponse: Response | null = null;

        // 1. Єдиний консолідований JSON компанії: /{year}/{edrpou}.json (напр. 2025/32673400.json)
        const unifiedMatch = key.match(/^(\d{4})\/(\d{6,10})\.json$/);
        if (unifiedMatch) {
          const [, year, edrpou] = unifiedMatch;
          const cacheTag = `company-${edrpou},year-${year},finzvit-data`;

          const unifiedObj = await env.R2_BUCKET.get(key);
          if (unifiedObj) {
            const headers = new Headers();
            unifiedObj.writeHttpMetadata(headers);
            headers.set('etag', unifiedObj.httpEtag);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            headers.set('Cache-Tag', cacheTag);
            headers.set('X-FinZvit-Source', 'r2-unified');

            finalResponse = new Response(unifiedObj.body, { headers });
          }
        } else {
          // 2. Будь-який інший прямий ключ в R2 (наприклад companies_registry.json)
          const directObj = await env.R2_BUCKET.get(key);
          if (directObj) {
            const headers = new Headers();
            directObj.writeHttpMetadata(headers);
            headers.set('etag', directObj.httpEtag);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            finalResponse = new Response(directObj.body, { headers });
          }
        }

        // Якщо в R2 знайдено відповідь: кешуємо в Edge Cache і повертаємо
        if (finalResponse && finalResponse.status === 200) {
          finalResponse.headers.set('X-FinZvit-Cache', 'MISS');
          if (cache && ctx?.waitUntil && request.method === 'GET') {
            ctx.waitUntil(cache.put(request, finalResponse.clone()));
          }
          return finalResponse;
        }

        // Якщо в R2 нічого не знайдено — fallback до статичних файлів (якщо такі є в dist/data)
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
          const assetRes = await env.ASSETS.fetch(request);
          if (assetRes.status < 400) {
            return assetRes;
          }
        }

        return new Response(JSON.stringify({ error: 'Дані не знайдено', key }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Помилка обробки запиту даних', details: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }

    // 2. Обробка динамічних маршрутів сторінки компанії (/company/:edrpou)
    if (url.pathname.startsWith('/company/')) {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes.status !== 404) {
          return assetRes;
        }

        // Якщо окремого статичного HTML для цього ЄДРПОУ немає в dist:
        // Віддаємо універсальну HTML-оболонку сторінки компанії (/company/32673400/index.html)
        const shellUrl = new URL('/company/32673400/', request.url);
        const shellRes = await env.ASSETS.fetch(shellUrl.toString());
        if (shellRes.ok) {
          return new Response(shellRes.body, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
        return assetRes;
      }
    }

    // 3. Обробка решти статичних ассетів та 404-сторінки
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
