const input = document.getElementById("wordInput");
const headlineEl = document.getElementById("headline");
const metaEl = document.getElementById("meta");
const linkEl = document.getElementById("link");
const scriptUrl = new URL(document.currentScript.src);
const headlinesUrl = new URL("../data/headlines.json", scriptUrl);

let headlineData = null;

// Source link is now rendered inline in #meta.
if (linkEl) linkEl.remove();

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

  const res = await fetch(headlinesUrl, { cache: "no-store" });
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHeadlineWithQuery(headlineElement, title, query) {
  headlineElement.replaceChildren();

  if (!title) return;
  if (!query) {
    headlineElement.textContent = title;
    return;
  }

  const safeQuery = escapeRegExp(query);
  const re = new RegExp(safeQuery, "gi");
  let cursor = 0;

  for (const match of title.matchAll(re)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (start > cursor) {
      headlineElement.append(document.createTextNode(title.slice(cursor, start)));
    }

    const em = document.createElement("em");
    em.textContent = title.slice(start, end);
    headlineElement.append(em);

    cursor = end;
  }

  if (cursor < title.length) {
    headlineElement.append(document.createTextNode(title.slice(cursor)));
  }
}

function renderNoMatchesMessage(headlineElement, query, suggestion, onSuggestion) {
  headlineElement.replaceChildren();
  headlineElement.append(
    document.createTextNode(`Florida man doesn't like "${query}". Try `)
  );

  const button = document.createElement("button");
  button.type = "button";
  button.className = "suggestion";
  button.textContent = suggestion;
  button.addEventListener("click", onSuggestion);
  headlineElement.append(button);

  headlineElement.append(document.createTextNode("."));
}

async function fetchHeadline(word) {
  headlineEl.textContent = "Loading...";
  metaEl.replaceChildren();

  try {
    const headlines = await loadHeadlines();
    const matches = headlines.filter((item) => matchesHeadline(item, word));

    if (matches.length === 0) {
      const suggestions = ["meth", "police", "crocodile", "arrest", "coke", "neighbor"];
      const viable = suggestions.filter((s) =>
        headlines.some((item) => matchesHeadline(item, s))
      );
      const pool = viable.length ? viable : suggestions;
      const suggestion = pool[Math.floor(Math.random() * pool.length)];

      renderNoMatchesMessage(headlineEl, word, suggestion, () => {
        input.value = suggestion;
        void fetchHeadline(suggestion);
      });
      return;
    }

    const pick = matches[Math.floor(Math.random() * matches.length)];
    const formattedDate = formatDate(pick.date);
    let sourceDomain = (pick.source || "").trim();
    if (pick.url) {
      try {
        sourceDomain = new URL(pick.url).hostname.replace(/^www\./i, "");
      } catch {
        // ignore invalid URL and fall back to pick.source
      }
    }

    const sourceLabel = sourceDomain || "Unknown source";

    renderHeadlineWithQuery(headlineEl, pick.title, word);
    if (formattedDate) {
      metaEl.append(document.createTextNode(formattedDate));
    }

    if (sourceLabel) {
      if (pick.url) {
        const a = document.createElement("a");
        a.href = pick.url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = sourceLabel;
        metaEl.append(a);
      } else {
        metaEl.append(document.createTextNode(sourceLabel));
      }
    }
  } catch (err) {
    console.error(err);
    headlineEl.textContent = "Couldn't load the headline database.";
  }
}
