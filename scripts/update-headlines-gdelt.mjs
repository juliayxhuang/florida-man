import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "data", "headlines.json");
const targetCount = Number(process.argv[2] || 1000);
const maxDaysBack = Number(process.argv[3] || 90);
const rangeStartArg = process.argv[4] || "";
const rangeEndArg = process.argv[5] || "";
const windowDays = 3;
const maxRecords = 250;
const retryCount = 3;

const query = '("Florida man" OR "Florida woman")';
const allowedTitlePattern = /\bflorida\s+(man|woman)\b/i;
const blockedTitlePattern = /\b(obituary|newsletter|horoscope|lottery results)\b/i;

const stopWords = new Set([
  "after", "again", "against", "and", "are", "for", "from", "has", "have",
  "into", "man", "new", "not", "over", "say", "says", "the", "this", "was",
  "who", "with", "woman"
]);

function formatGdeltDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function formatDisplayDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateArg(value, endOfPeriod = false) {
  if (!value) return null;

  const yearOnly = value.match(/^\d{4}$/);
  if (yearOnly) {
    const year = Number(value);
    return endOfPeriod
      ? new Date(Date.UTC(year, 11, 31, 23, 59, 59))
      : new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  }

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    return endOfPeriod
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }

  throw new Error(`Invalid date "${value}". Use YYYY or YYYY-MM-DD.`);
}

function parseGdeltDate(value) {
  if (!value || value.length < 8) return "";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function cleanTitle(title) {
  return title
    .replace(/\s+([?.!,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordsFromTitle(title, domain) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
  const domainWords = String(domain || "")
    .replace(/^www\./, "")
    .split(/[.\-]/)
    .filter((word) => word.length > 2);
  return [...new Set([...words, ...domainWords])].slice(0, 16);
}

function normalizeArticle(article) {
  const title = cleanTitle(article.title || "");
  if (!allowedTitlePattern.test(title) || blockedTitlePattern.test(title)) return null;
  if (!article.url || !article.domain) return null;

  return {
    title,
    url: article.url,
    source: article.domain,
    date: parseGdeltDate(article.seendate),
    image: article.socialimage || "",
    keywords: keywordsFromTitle(title, article.domain)
  };
}

function addSeenKeys(seen, item) {
  if (item.url) seen.add(item.url.toLowerCase());
  if (item.title) seen.add(item.title.toLowerCase());
}

async function loadExistingItems() {
  try {
    const raw = await fs.readFile(outPath, "utf8");
    const json = JSON.parse(raw);
    const existingItems = Array.isArray(json) ? json : (json.items || []);
    return existingItems
      .filter((item) => item && item.title && item.url)
      .slice(0, targetCount);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function fetchWindow(startDate, endDate) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("maxrecords", String(maxRecords));
  url.searchParams.set("startdatetime", formatGdeltDate(startDate));
  url.searchParams.set("enddatetime", formatGdeltDate(endDate));

  const payload = await fetchJsonWithRetries(url);
  return Array.isArray(payload.articles) ? payload.articles : [];
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "florida-man-generator/1.0 dataset builder"
      },
      timeout: 20_000
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GDELT request failed (${res.statusCode})`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("GDELT returned invalid JSON"));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("GDELT request timed out"));
    });
    req.on("error", reject);
  });
}

async function fetchJsonWithRetries(url) {
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err;
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function main() {
  const seen = new Set();
  const items = await loadExistingItems();
  for (const item of items) addSeenKeys(seen, item);

  const now = new Date();
  const rangeEnd = parseDateArg(rangeEndArg, true) || now;
  const rangeStart = parseDateArg(rangeStartArg, false) || new Date(rangeEnd.getTime() - maxDaysBack * 86400_000);
  if (rangeStart >= rangeEnd) {
    throw new Error("Start date must be before end date.");
  }

  console.log(`Loaded ${items.length} existing headlines.`);
  console.log(`Searching ${formatDisplayDate(rangeStart)} through ${formatDisplayDate(rangeEnd)}.`);

  for (let endDate = rangeEnd; endDate > rangeStart && items.length < targetCount;) {
    const startDate = new Date(Math.max(rangeStart.getTime(), endDate.getTime() - windowDays * 86400_000));
    process.stdout.write(`Fetching ${formatGdeltDate(startDate)}-${formatGdeltDate(endDate)}... `);

    try {
      const articles = await fetchWindow(startDate, endDate);
      let added = 0;
      for (const article of articles) {
        const item = normalizeArticle(article);
        if (!item) continue;
        const key = item.url.toLowerCase();
        const titleKey = item.title.toLowerCase();
        if (seen.has(key) || seen.has(titleKey)) continue;
        addSeenKeys(seen, item);
        items.push(item);
        added += 1;
        if (items.length >= targetCount) break;
      }
      console.log(`${added} added (${items.length} total)`);
    } catch (err) {
      console.log(`skipped: ${err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    endDate = startDate;
  }

  const output = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: "gdelt-doc-2.0",
    query,
    count: items.length,
    items
  };

  await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${items.length} sourced headlines to ${path.relative(repoRoot, outPath)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
