const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const cache = new Map(); // key -> { expiresAt:number, payload:any }
const CACHE_TTL_MS = 30_000;

function sendJson(res, statusCode, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    ...extraHeaders
  });
  res.end(text);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

async function handleRedditSearch(req, res, url) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const word = (url.searchParams.get("word") || "").trim();
  if (!word) {
    sendJson(res, 400, { error: "Missing ?word=" });
    return;
  }
  if (word.split(/\s+/).length > 1) {
    sendJson(res, 400, { error: "Only one word allowed" });
    return;
  }

  const cacheKey = `reddit-search:${word.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (req.method === "HEAD") {
      res.writeHead(204, { "X-Cache": "HIT" });
      res.end();
      return;
    }
    sendJson(res, 200, cached.payload, { "X-Cache": "HIT" });
    return;
  }

  const redditUrl = new URL("https://www.reddit.com/r/FloridaMan/search.json");
  redditUrl.searchParams.set("q", `Florida Man ${word}`);
  redditUrl.searchParams.set("restrict_sr", "1");
  redditUrl.searchParams.set("sort", "relevance");
  redditUrl.searchParams.set("limit", "25");
  redditUrl.searchParams.set("raw_json", "1");

  try {
    const upstream = await fetch(redditUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "florida-man-project/1.0 (local dev server)"
      }
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      sendText(res, 502, "Upstream returned invalid JSON");
      return;
    }

    if (!upstream.ok) {
      sendJson(res, upstream.status, payload);
      return;
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    if (req.method === "HEAD") {
      res.writeHead(204, { "X-Cache": "MISS" });
      res.end();
      return;
    }
    sendJson(res, 200, payload, { "X-Cache": "MISS" });
  } catch (err) {
    sendJson(res, 502, { error: "Failed to reach Reddit", detail: String(err?.message || err) });
  }
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";

  const resolved = path.resolve(ROOT_DIR, `.${pathname}`);
  const rootPrefix = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(resolved);
    if (stat.isDirectory()) {
      const indexPath = path.join(resolved, "index.html");
      stat = await fsp.stat(indexPath);
      return serveFile(req, res, indexPath, stat);
    }
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  return serveFile(req, res, resolved, stat);
}

function serveFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": "no-store"
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal server error");
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/reddit-search") {
    await handleRedditSearch(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
