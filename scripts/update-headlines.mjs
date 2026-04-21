import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUT_PATH = path.join(repoRoot, "data", "headlines.json");
const USER_AGENT = "florida-man-bingo/1.0 (github actions; contact: repo owner)";

const endpoints = [
  "https://www.reddit.com/r/FloridaMan/top.json?limit=100&t=all",
  "https://www.reddit.com/r/FloridaMan/hot.json?limit=100",
  "https://www.reddit.com/r/FloridaMan/top.json?limit=100&t=year",
  "https://www.reddit.com/r/FloridaMan/top.json?limit=100&t=month",
];

function uniqByTitle(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.title) continue;
    const key = item.title.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ title: key, url: typeof item.url === "string" ? item.url : "" });
  }
  return out;
}

async function fetchEndpoint(url) {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit request failed: ${res.status} ${res.statusText} (${url})`);
  }

  const data = await res.json();
  const children = data?.data?.children || [];
  return children
    .map((c) => c?.data)
    .filter((p) => p && !p.stickied && typeof p.title === "string" && p.title.length > 15)
    .map((p) => ({
      title: p.title,
      url: typeof p.permalink === "string" ? `https://www.reddit.com${p.permalink}` : "",
    }));
}

async function main() {
  let existing;
  try {
    existing = JSON.parse(await readFile(OUT_PATH, "utf8"));
  } catch {
    existing = null;
  }

  const all = [];
  for (const url of endpoints) {
    // Keep running even if one endpoint fails; we'll decide overall failure later.
    try {
      all.push(...(await fetchEndpoint(url)));
    } catch (err) {
      console.warn(String(err));
    }
  }

  const items = uniqByTitle(all);
  if (items.length < 25) {
    const hint = `Only fetched ${items.length} items. Not updating ${path.relative(repoRoot, OUT_PATH)}.`;
    console.error(hint);
    process.exitCode = 1;
    return;
  }

  // Stable output to reduce noisy diffs.
  items.sort((a, b) => a.title.localeCompare(b.title));

  const next = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "reddit",
    items,
  };

  // If the only change is generatedAt, avoid rewriting.
  if (existing?.source === next.source && Array.isArray(existing?.items)) {
    const prevItems = JSON.stringify(existing.items);
    const nextItems = JSON.stringify(next.items);
    if (prevItems === nextItems) {
      console.log("No headline changes; leaving file as-is.");
      return;
    }
  }

  await writeFile(OUT_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`Wrote ${items.length} headlines to ${path.relative(repoRoot, OUT_PATH)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

