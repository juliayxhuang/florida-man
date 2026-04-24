const headlines = require("../data/headlines.json");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function getItems() {
  return Array.isArray(headlines) ? headlines : (headlines.items || []);
}

function matchesWord(item, word) {
  const needle = word.toLowerCase();
  const haystack = [
    item.title,
    item.source,
    ...(Array.isArray(item.keywords) ? item.keywords : [])
  ].join(" ").toLowerCase();
  return haystack.includes(needle);
}

function toRedditListing(items) {
  return {
    kind: "Listing",
    source: headlines.source || "saved-headlines",
    data: {
      children: items.map((item, index) => ({
        kind: "t3",
        data: {
          title: item.title,
          created_utc: item.date ? Date.parse(`${item.date}T00:00:00Z`) / 1000 : Date.now() / 1000 - index * 86400,
          url: item.url || "",
          domain: item.source || ""
        }
      }))
    }
  };
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const word = String(req.query.word || "").trim();
  if (!word) {
    res.status(400).json({ error: "Missing ?word=" });
    return;
  }

  if (word.split(/\s+/).length > 1) {
    res.status(400).json({ error: "Only one word allowed" });
    return;
  }

  const items = getItems().filter((item) => matchesWord(item, word)).slice(0, 50);
  res.setHeader("X-Source", headlines.source || "saved-headlines");
  res.setHeader("X-Headline-Count", String(items.length));

  if (req.method === "HEAD") {
    res.status(204).end();
    return;
  }

  res.status(200).json(toRedditListing(items));
};
