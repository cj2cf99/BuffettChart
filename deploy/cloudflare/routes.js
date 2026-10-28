// BuffettChart read-only subpage. Reuses the existing public/ asset binding.
export function publicAsset(name) {
  return name===''||name==='index.html'||/^fixed\/(?:app|chart|series|freshness)\.[a-f0-9]{16}\.js$/.test(name)||/^fixed\/style\.[a-f0-9]{16}\.css$/.test(name)||/^fixed\/(?:history|\d{4}Q[1-4])\.[a-f0-9]{16}\.json$/.test(name)||/^updates\/(?:current|recent)\.json$/.test(name);
}
export async function handleBuffett(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/buffett' && !url.pathname.startsWith('/buffett/')) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status:405, headers:{Allow:'GET, HEAD'} });
  if (url.pathname === '/buffett') {
    url.pathname = '/buffett/';
    return Response.redirect(url.toString(),301);
  }
  const relative = url.pathname.slice('/buffett/'.length);
  if (!publicAsset(relative)) return new Response('Not Found',{status:404});
  if (!env.STOCKCHECK_ASSETS?.fetch) return new Response('Buffett assets unavailable',{status:503});
  if (!relative) url.pathname += 'index.html';
  const response = await env.STOCKCHECK_ASSETS.fetch(new Request(url.toString(),request));
  const headers = new Headers(response.headers);
  headers.set('Cache-Control',relative.startsWith('fixed/')&&response.ok?'private, max-age=31536000, immutable':'private, max-age=0, must-revalidate');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  headers.set('X-Frame-Options','SAMEORIGIN');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,statusText:response.statusText,headers});
}
