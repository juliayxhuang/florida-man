const CACHE_TTL_MS = 30_000;
const cache = new Map();

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const word = String(req.query.word || "").trim();
  if (!word) {
    sendJson(res, 400, { error: "Missing ?word=" });
    return;
  }

  if (word.split(/\s+/).length > 1) {
    sendJson(res, 400, { error: "Only one word allowed" });
    return;
  }

  const cacheKey = word.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("X-Cache", "HIT");
    if (req.method === "HEAD") {
      res.status(204).end();
      return;
    }
    sendJson(res, 200, cached.payload);
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
        "User-Agent": "florida-man-project/1.0 (vercel api)"
      }
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      sendJson(res, 502, { error: "Upstream returned invalid JSON" });
      return;
    }

    if (!upstream.ok) {
      sendJson(res, upstream.status, payload);
      return;
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    res.setHeader("X-Cache", "MISS");

    if (req.method === "HEAD") {
      res.status(204).end();
      return;
    }

    sendJson(res, 200, payload);
  } catch (err) {
    sendJson(res, 502, {
      error: "Failed to reach Reddit",
      detail: String(err?.message || err)
    });
  }
};
