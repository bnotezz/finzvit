interface Env {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Спробуємо отримати статично згенеровану сторінку
  const res = await context.next();
  
  // Якщо сторінка для цього конкретного ЄДРПОУ не була пре-рендерена під час білду,
  // віддаємо універсальну оболонку CompanyPageView, яка змонтується на клієнті
  if (res.status === 404) {
    const fallbackUrl = new URL('/company/', context.request.url);
    const fallbackRes = await context.env.ASSETS.fetch(fallbackUrl.toString());
    
    // Повертаємо 200 OK з HTML оболонкою
    return new Response(fallbackRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return res;
};
