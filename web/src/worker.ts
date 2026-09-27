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
        let cacheTag: string | null = null;

        // ПАТЕРН А: Запит консолідованого файлу компанії: /{year}/{edrpou}.json
        // Наприклад: /data/2025/32673400.json
        const unifiedMatch = key.match(/^(\d{4})\/(\d{6,10})\.json$/);
        if (unifiedMatch) {
          const [, year, edrpou] = unifiedMatch;
          cacheTag = `company-${edrpou},year-${year},finzvit-data`;

          // 1. Спроба взяти єдиний файл з R2
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
          } else {
            // 2. Fallback / Проксі: якщо єдиного файлу ще немає в R2, зшиваємо на льоту зі старих split-файлів
            // Шукаємо {year}/{edrpou}/meta.json
            const metaObj = await env.R2_BUCKET.get(`${year}/${edrpou}/meta.json`);
            if (metaObj) {
              const metaText = await metaObj.text();
              const metaData = JSON.parse(metaText);
              const forms = metaData.available_forms || [];

              // Паралельно завантажуємо всі форми компанії
              const reports: Record<string, any> = {};
              await Promise.all(
                forms.map(async (f: any) => {
                  if (!f.code) return;
                  try {
                    const formObj = await env.R2_BUCKET!.get(`${year}/${edrpou}/${f.code}.json`);
                    if (formObj) {
                      const formText = await formObj.text();
                      const parsed = JSON.parse(formText);
                      reports[f.code] = parsed.data || parsed;
                    }
                  } catch (e) {
                    // Ігноруємо поодинокі збої окремих форм
                  }
                })
              );

              const unifiedData = {
                ...metaData,
                year: Number(year),
                reports,
              };

              const headers = new Headers();
              headers.set('Content-Type', 'application/json; charset=utf-8');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
              headers.set('Cache-Tag', cacheTag);
              headers.set('X-FinZvit-Source', 'stitched-proxy');

              finalResponse = new Response(JSON.stringify(unifiedData), { headers });
            }
          }
        }

        // ПАТЕРН Б: Запит legacy-метаданих: /{year}/{edrpou}/meta.json
        const metaMatch = key.match(/^(\d{4})\/(\d{6,10})\/meta\.json$/);
        if (!finalResponse && metaMatch) {
          const [, year, edrpou] = metaMatch;
          cacheTag = `company-${edrpou},year-${year},finzvit-data`;

          const metaObj = await env.R2_BUCKET.get(key);
          if (metaObj) {
            const headers = new Headers();
            metaObj.writeHttpMetadata(headers);
            headers.set('etag', metaObj.httpEtag);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            headers.set('Cache-Tag', cacheTag);
            finalResponse = new Response(metaObj.body, { headers });
          } else {
            // Зворотна сумісність: витягуємо meta з консолідованого /{year}/{edrpou}.json
            const unifiedObj = await env.R2_BUCKET.get(`${year}/${edrpou}.json`);
            if (unifiedObj) {
              const uData = JSON.parse(await unifiedObj.text());
              const { reports, ...metaOnly } = uData;
              const headers = new Headers();
              headers.set('Content-Type', 'application/json; charset=utf-8');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
              headers.set('Cache-Tag', cacheTag);
              finalResponse = new Response(JSON.stringify(metaOnly), { headers });
            }
          }
        }

        // ПАТЕРН В: Запит окремої форми: /{year}/{edrpou}/{formCode}.json
        const formMatch = key.match(/^(\d{4})\/(\d{6,10})\/([A-Za-z0-9_]+)\.json$/);
        if (!finalResponse && formMatch) {
          const [, year, edrpou, formCode] = formMatch;
          cacheTag = `company-${edrpou},year-${year},finzvit-data`;

          const formObj = await env.R2_BUCKET.get(key);
          if (formObj) {
            const headers = new Headers();
            formObj.writeHttpMetadata(headers);
            headers.set('etag', formObj.httpEtag);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            headers.set('Cache-Tag', cacheTag);
            finalResponse = new Response(formObj.body, { headers });
          } else {
            // Зворотна сумісність: витягуємо форму з консолідованого /{year}/{edrpou}.json
            const unifiedObj = await env.R2_BUCKET.get(`${year}/${edrpou}.json`);
            if (unifiedObj) {
              const uData = JSON.parse(await unifiedObj.text());
              const rep = uData.reports?.[formCode];
              if (rep) {
                const rowData = rep.data || rep;
                const formMeta = uData.available_forms?.find((f: any) => f.code === formCode);
                const singleForm = {
                  meta: {
                    form_code: formCode,
                    form_name: formMeta?.title || `Форма ${formCode}`,
                    period_year: uData.year || Number(year),
                    date_filled: formMeta?.date_filled,
                    timestamp: formMeta?.timestamp
                  },
                  company: {
                    edrpou: uData.edrpou,
                    name: uData.name,
                    kved: uData.kved,
                    kved_name: uData.kved_name,
                    address: uData.address,
                    director: uData.director,
                    employees: uData.employees,
                    accounting_standard: uData.accounting_standard
                  },
                  data: rowData
                };
                const headers = new Headers();
                headers.set('Content-Type', 'application/json; charset=utf-8');
                headers.set('Access-Control-Allow-Origin', '*');
                headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                headers.set('Cache-Tag', cacheTag);
                finalResponse = new Response(JSON.stringify(singleForm), { headers });
              }
            }
          }
        }

        // ПАТЕРН Г: Будь-який інший прямий ключ в R2 (наприклад companies_registry.json)
        if (!finalResponse) {
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
          if (assetRes.status === 200) {
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

    // 2. Обробка статичних ассетів та SPA-сторінок фронтенду
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
