export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  R2_BUCKET?: {
    get: (key: string) => Promise<{
      body: ReadableStream;
      arrayBuffer: () => Promise<ArrayBuffer>;
      httpEtag: string;
      writeHttpMetadata: (headers: Headers) => void;
      httpMetadata?: {
        contentEncoding?: string;
        contentType?: string;
      };
    } | null>;
  };
  CACHE_VERSION?: string;
}

interface MemoryCacheItem {
  bytes: ArrayBuffer;
  etag: string;
  cacheTag?: string;
  version: string;
}

// In-memory кеш для гарячих звітів компаній на рівні воркер-ізоляту
// Забезпечує миттєвий HIT (< 1 мс) та 0 звернень до R2 навіть на *.workers.dev
// (де системний Cloudflare Cache API офіційно відключений платформою)
const memoryCache = new Map<string, MemoryCacheItem>();
const MAX_MEMORY_ITEMS = 500;
let lastPurgedVersion: string | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Безпечне глобальне версіонування кешу (через CACHE_VERSION у wrangler.jsonc / Dashboard)
    const cacheVersion = env.CACHE_VERSION || 'v1';

    // Автоматичне глобальне очищення Cloudflare Workers Cache та локального ізоляту при зміні версії
    if (lastPurgedVersion !== cacheVersion) {
      lastPurgedVersion = cacheVersion;
      memoryCache.clear();
      if (ctx?.cache && typeof ctx.cache.purge === 'function') {
        try {
          ctx.waitUntil(ctx.cache.purge({ purgeEverything: true }));
        } catch (e) {
          console.warn('ctx.cache.purge error:', e);
        }
      }
    }

    // 1. Обробка запитів до фінансових даних (/data/...)
    if (url.pathname.startsWith('/data/')) {
      const key = url.pathname.replace(/^\/data\//, '');
      if (!key) {
        return new Response(JSON.stringify({ error: 'Key not specified' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const isHead = request.method === 'HEAD';
      const isGet = request.method === 'GET';
      if (!isGet && !isHead) {
        return new Response('Method Not Allowed', { status: 405 });
      }

      const acceptEncoding = request.headers.get('Accept-Encoding') || '';
      const acceptsGzip = acceptEncoding.includes('gzip') || acceptEncoding.includes('*');

      // 1.1. Перевірка in-memory кешу ізоляту воркера
      const memCached = memoryCache.get(key);
      if (memCached && memCached.version === cacheVersion) {
        const headers = new Headers();
        headers.set('etag', memCached.etag);
        headers.set('Content-Type', 'application/json; charset=utf-8');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, no-transform');
        if (memCached.cacheTag) headers.set('Cache-Tag', memCached.cacheTag);
        headers.set('X-FinZvit-Source', 'r2-unified');
        headers.set('Vary', 'Accept-Encoding');
        headers.set('X-FinZvit-Cache', 'HIT');
        headers.set('X-FinZvit-Cache-Version', cacheVersion);

        if (isHead) {
          if (acceptsGzip) headers.set('Content-Encoding', 'gzip');
          return new Response(null, { status: 200, headers });
        }

        if (acceptsGzip) {
          headers.set('Content-Encoding', 'gzip');
          return new Response(memCached.bytes, {
            headers,
            encodeBody: 'manual',
          } as any);
        } else {
          headers.delete('Content-Encoding');
          const decompressed = new Response(memCached.bytes).body!.pipeThrough(new DecompressionStream('gzip'));
          return new Response(decompressed, { headers });
        }
      }

      // 1.2. Перевірка Cloudflare Edge Cache API (для Custom Domains)
      const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
      const cacheUrl = new URL(request.url);
      cacheUrl.searchParams.set('_v', cacheVersion);
      const cacheKey = new Request(cacheUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      });

      if (cache) {
        try {
          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            const hitHeaders = new Headers(cachedResponse.headers);
            hitHeaders.set('X-FinZvit-Cache', 'HIT');
            hitHeaders.set('X-FinZvit-Cache-Version', cacheVersion);
            if (isHead) {
              return new Response(null, { status: cachedResponse.status, headers: hitHeaders });
            }
            return new Response(cachedResponse.body, { status: cachedResponse.status, headers: hitHeaders });
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

        const acceptEncoding = request.headers.get('Accept-Encoding') || '';
        const acceptsGzip = acceptEncoding.includes('gzip') || acceptEncoding.includes('*');

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
            headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, no-transform');
            headers.set('Cache-Tag', cacheTag);
            headers.set('X-FinZvit-Source', 'r2-unified');
            headers.set('Vary', 'Accept-Encoding');
            headers.set('X-FinZvit-Cache', 'MISS');
            headers.set('X-FinZvit-Cache-Version', cacheVersion);

            const rawBytes = await unifiedObj.arrayBuffer();

            // Зберігаємо в in-memory кеш ізоляту воркера (активно на *.workers.dev)
            if (memoryCache.size >= MAX_MEMORY_ITEMS) {
              const oldestKey = memoryCache.keys().next().value;
              if (oldestKey) memoryCache.delete(oldestKey);
            }
            memoryCache.set(key, {
              bytes: rawBytes,
              etag: unifiedObj.httpEtag,
              cacheTag,
              version: cacheVersion,
            });

            // Зберігаємо також в системний Cache API (для Custom Domains)
            if (cache && ctx?.waitUntil) {
              const cacheHeaders = new Headers(headers);
              cacheHeaders.set('Content-Encoding', 'gzip');
              const toCache = new Response(rawBytes, {
                headers: cacheHeaders,
                encodeBody: 'manual',
              } as any);
              ctx.waitUntil(cache.put(cacheKey, toCache));
            }

            if (isHead) {
              if (acceptsGzip) headers.set('Content-Encoding', 'gzip');
              return new Response(null, { status: 200, headers });
            }

            if (acceptsGzip) {
              headers.set('Content-Encoding', 'gzip');
              return new Response(rawBytes, {
                headers,
                encodeBody: 'manual',
              } as any);
            } else {
              headers.delete('Content-Encoding');
              const decompressed = new Response(rawBytes).body!.pipeThrough(new DecompressionStream('gzip'));
              return new Response(decompressed, { headers });
            }
          }
        } else {
          // 2. Будь-який інший прямий ключ в R2
          const directObj = await env.R2_BUCKET.get(key);
          if (directObj) {
            const headers = new Headers();
            directObj.writeHttpMetadata(headers);
            headers.set('etag', directObj.httpEtag);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, no-transform');
            headers.set('X-FinZvit-Cache', 'MISS');
            headers.set('X-FinZvit-Cache-Version', cacheVersion);

            const isGzip = directObj.httpMetadata?.contentEncoding === 'gzip';
            const rawBytes = await directObj.arrayBuffer();

            if (isHead) {
              if (isGzip && acceptsGzip) headers.set('Content-Encoding', 'gzip');
              return new Response(null, { status: 200, headers });
            }

            if (isGzip) {
              headers.set('Vary', 'Accept-Encoding');
              if (acceptsGzip) {
                headers.set('Content-Encoding', 'gzip');
                return new Response(rawBytes, {
                  headers,
                  encodeBody: 'manual',
                } as any);
              } else {
                headers.delete('Content-Encoding');
                const decompressed = new Response(rawBytes).body!.pipeThrough(new DecompressionStream('gzip'));
                return new Response(decompressed, { headers });
              }
            } else {
              return new Response(rawBytes, { headers });
            }
          }
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

    // 2. Обробка динамічних маршрутів сторінки компанії (/company/:edrpou або /company)
    if (url.pathname === '/company' || url.pathname.startsWith('/company/')) {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes.status < 400) {
          return assetRes;
        }

        // Віддаємо універсальну чисту HTML-оболонку сторінки компанії (/company/index.html)
        const shellUrl = new URL('/company/', request.url);
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
