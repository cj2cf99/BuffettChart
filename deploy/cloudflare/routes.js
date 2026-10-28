// BuffettChart read-only subpage. Reuses the existing public/ asset binding.
const allowed = new Set(['', 'index.html', 'style.css', 'app.js', 'freshness.js', 'snapshot.json', 'historical.svg', 'detrended.svg']);
export async function handleBuffett(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/buffett' && !url.pathname.startsWith('/buffett/')) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status:405, headers:{Allow:'GET, HEAD'} });
  if (url.pathname === '/buffett') {
    url.pathname = '/buffett/';
    return Response.redirect(url.toString(),301);
  }
  const relative = url.pathname.slice('/buffett/'.length);
  if (!allowed.has(relative)) return new Response('Not Found',{status:404});
  if (!env.STOCKCHECK_ASSETS?.fetch) return new Response('Buffett assets unavailable',{status:503});
  if (!relative) url.pathname += 'index.html';
  const response = await env.STOCKCHECK_ASSETS.fetch(new Request(url.toString(),request));
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','private, max-age=0, must-revalidate');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  headers.set('X-Frame-Options','SAMEORIGIN');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,statusText:response.statusText,headers});
}
