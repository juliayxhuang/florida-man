const input = document.getElementById("wordInput");
const headlineEl = document.getElementById("headline");
const metaEl = document.getElementById("meta");
const linkEl = document.getElementById("link");

let headlineData = null;

input.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const value = input.value.trim();
  if (value.split(/\s+/).length > 1) {
    headlineEl.textContent = "Too many words.";
    metaEl.textContent = "";
    linkEl.textContent = "";
    return;
  }

  if (!value) return;
  fetchHeadline(value);
});

async function loadHeadlines() {
  if (headlineData) return headlineData;

  const dataUrl = new URL("../data/headlines.json", window.location.href);
  const res = await fetch(dataUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Headline data request failed (${res.status})`);

  const json = await res.json();
  headlineData = Array.isArray(json) ? json : (json.items || []);
  return headlineData;
}

function matchesHeadline(item, word) {
  const needle = word.toLowerCase();
  const haystack = [
    item.title,
    item.source,
    ...(Array.isArray(item.keywords) ? item.keywords : [])
  ].join(" ").toLowerCase();

  return haystack.includes(needle);
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

async function fetchHeadline(word) {
  headlineEl.textContent = "Loading...";
  metaEl.textContent = "";
  linkEl.textContent = "";
  linkEl.removeAttribute("href");

  try {
    const headlines = await loadHeadlines();
    const matches = headlines.filter((item) => matchesHeadline(item, word));

    if (matches.length === 0) {
      headlineEl.textContent = `No saved headline found for "${word}". Try arrest, police, car, beach, or Florida.`;
      return;
    }

    const pick = matches[Math.floor(Math.random() * matches.length)];
    const formattedDate = formatDate(pick.date);
    const source = (pick.source || "UNKNOWN SOURCE").toUpperCase();

    headlineEl.textContent = pick.title;
    metaEl.textContent = [formattedDate, source].filter(Boolean).join(" · ");

    if (pick.url) {
      linkEl.href = pick.url;
      linkEl.textContent = "READ ARTICLE";
    }
  } catch (err) {
    console.error(err);
    headlineEl.textContent = "Couldn't load the headline database.";
  }
}
