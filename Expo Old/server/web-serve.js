/**
 * Web server for Expo static web builds.
 * Serves dist/ and proxies /api/* → backend on port 3000.
 * Same-origin approach eliminates all CORS issues.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "3000", 10);
const PORT = parseInt(process.env.PORT || "5000", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function proxyToBackend(req, res, targetPath) {
  const options = {
    hostname: "127.0.0.1",
    port: BACKEND_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${BACKEND_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Backend unavailable", error: err.message }));
  });

  req.pipe(proxyReq, { end: true });
}

function serveStatic(pathname, res) {
  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(DIST_ROOT, safePath);

  if (!filePath.startsWith(DIST_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_ROOT, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);

  const headers = { "content-type": contentType };
  if (ext === ".html") {
    headers["cache-control"] = "no-cache";
  }

  res.writeHead(200, headers);
  res.end(content);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    const targetPath = pathname.slice(4) + (url.search || "");
    return proxyToBackend(req, res, targetPath);
  }

  serveStatic(pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
  console.log(`Serving: ${DIST_ROOT}`);
  console.log(`API proxy: /api/* → http://127.0.0.1:${BACKEND_PORT}/*`);
});
