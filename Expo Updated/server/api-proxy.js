const https = require('node:https');
const http = require('node:http');

/** Fixed upstream only: clients cannot choose hosts or forward cookies. */
function proxyApi(req, res, next) {
  if (!req.url?.startsWith('/api/')) return next();
  const origin = process.env.BACKEND_API_URL || 'https://api.atherchain.com';
  const url = new URL(req.url.slice(4), origin);
  if (url.origin !== new URL(origin).origin) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Invalid API path.' }));
  }
  const headers = {};
  for (const key of ['authorization', 'content-type', 'accept', 'user-agent', 'idempotency-key']) {
    if (req.headers[key]) headers[key] = req.headers[key];
  }
  const transport = url.protocol === 'https:' ? https : http;
  const upstream = transport.request(url, { method: req.method, headers, timeout: 15000 }, response => {
    res.writeHead(response.statusCode || 502, {
      'Content-Type': response.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-store',
    });
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Backend request timed out.')));
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ message: 'The backend is unavailable. Check transaction history before retrying a payment.' }));
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}
module.exports = { proxyApi };
