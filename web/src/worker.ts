export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  R2_BUCKET?: {
    get: (key: string) => Promise<{
      body: ReadableStream;
      httpEtag: string;
      writeHttpMetadata: (headers: Headers) => void;
    } | null>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Route: /data/{year}/{edrpou}/{form}.json from private R2 bucket
    if (url.pathname.startsWith('/data/')) {
      const key = url.pathname.replace(/^\/data\//, '');
      if (!key) {
        return new Response(JSON.stringify({ error: 'Key not specified' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({ error: 'R2_BUCKET binding is missing in Cloudflare Worker settings' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const object = await env.R2_BUCKET.get(key);
        if (!object) {
          return new Response(JSON.stringify({ error: 'Report not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Type', 'application/json; charset=utf-8');
        headers.set('Access-Control-Allow-Origin', '*');
        // Cache at Cloudflare Edge CDN for 1 year (immutable historical financial reports)
        headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');

        return new Response(object.body, { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Error fetching from R2', details: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Fallback to static assets (handled automatically or via binding)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
