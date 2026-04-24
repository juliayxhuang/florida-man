const CACHE_TTL_MS = 30_000;
const cache = new Map();
let tokenCache = null;
const bundledHeadlines = require("../data/headlines.json");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function createFallbackPayload(word) {
  const searchUrl = `https://www.reddit.com/r/FloridaMan/search/?q=${encodeURIComponent(`Florida Man ${word}`)}&restrict_sr=1`;
  const needle = word.toLowerCase();
  const items = Array.isArray(bundledHeadlines)
    ? bundledHeadlines
    : (bundledHeadlines.items || []);
  const matches = items.filter((item) => item.title.toLowerCase().includes(needle));

  return {
    kind: "Listing",
    source: "bundled-fallback",
    data: {
      children: matches.map((item, index) => ({
        kind: "t3",
        data: {
          title: item.title,
          created_utc: Date.now() / 1000 - index * 86400,
          url: item.url || searchUrl
        }
      }))
    }
  };
}

function getUserAgent() {
  return process.env.REDDIT_USER_AGENT || "florida-man-generator/1.0 by juliayxhuang";
}

async function getRedditAccessToken() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Reddit OAuth credentials");
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": getUserAgent()
    },
    body
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Reddit token request failed (${response.status})`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000
  };

  return tokenCache.accessToken;
}

async function searchReddit(word) {
  const accessToken = await getRedditAccessToken();
  const redditUrl = new URL("https://oauth.reddit.com/r/FloridaMan/search");
  redditUrl.searchParams.set("q", `Florida Man ${word}`);
  redditUrl.searchParams.set("restrict_sr", "1");
  redditUrl.searchParams.set("sort", "relevance");
  redditUrl.searchParams.set("limit", "25");
  redditUrl.searchParams.set("type", "link");
  redditUrl.searchParams.set("raw_json", "1");

  const upstream = await fetch(redditUrl.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": getUserAgent()
    }
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload) {
    throw new Error(`Reddit search failed (${upstream.status})`);
  }

  return payload;
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

  try {
    const payload = await searchReddit(word);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("X-Source", "reddit-oauth");

    if (req.method === "HEAD") {
      res.status(204).end();
      return;
    }

    sendJson(res, 200, payload);
  } catch (err) {
    const fallbackPayload = createFallbackPayload(word);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: fallbackPayload });
    res.setHeader("X-Fallback", String(err?.message || err));
    sendJson(res, 200, fallbackPayload);
  }
};
