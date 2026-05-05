const input = document.getElementById("wordInput");
const headlineEl = document.getElementById("headline");
const metaEl = document.getElementById("meta");
const linkEl = document.getElementById("link");
const aboutBtn = document.getElementById("aboutBtn");
const aboutOverlay = document.getElementById("aboutOverlay");
const aboutCloseBtn = document.getElementById("aboutCloseBtn");
const scriptUrl = new URL(document.currentScript.src);
const headlinesUrl = new URL("../data/headlines.json", scriptUrl);

let headlineData = null;

// Source link is now rendered inline in #meta.
if (linkEl) linkEl.remove();

let activeWord = "";
let activeMatches = [];
let activeIndex = -1;

function setAboutOpen(isOpen) {
  if (!aboutOverlay) return;
  aboutOverlay.classList.toggle("is-open", isOpen);
  aboutOverlay.setAttribute("aria-hidden", String(!isOpen));
  if (aboutBtn) aboutBtn.style.visibility = isOpen ? "hidden" : "";
  if (isOpen) {
    aboutCloseBtn?.focus?.();
  } else {
    aboutBtn?.focus?.();
  }
}

aboutBtn?.addEventListener("click", () => {
  setAboutOpen(true);
});

aboutCloseBtn?.addEventListener("click", () => {
  setAboutOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (aboutOverlay?.classList.contains("is-open")) setAboutOpen(false);
});

function submitSearch() {
  if (aboutOverlay?.classList.contains("is-open")) setAboutOpen(false);

  const value = input.value.trim();
  if (value.split(/\s+/).length > 1) {
    headlineEl.textContent = "Too many words.";
    metaEl.replaceChildren();
    return;
  }

  if (!value) return;
  void fetchHeadline(value);
}

input.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  submitSearch();
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
  const needle = word.trim().toLowerCase();
  if (!needle) return false;

  const title = (item.title || "").toLowerCase();
  if (!title) return false;

  const tokens = title.match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.includes(needle);
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

function isLetterOrNumber(char) {
  if (!char) return false;
  return /[\p{L}\p{N}]/u.test(char);
}

function renderHeadlineWithQuery(headlineElement, title, query) {
  headlineElement.replaceChildren();

  if (!title) return;
  if (!query) {
    headlineElement.textContent = title;
    return;
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    headlineElement.textContent = title;
    return;
  }

  const safeQuery = escapeRegExp(normalizedQuery);
  const re = new RegExp(safeQuery, "gi");
  let cursor = 0;
  let renderedAny = false;

  for (const match of title.matchAll(re)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    const before = title[start - 1] || "";
    const after = title[end] || "";
    if (isLetterOrNumber(before) || isLetterOrNumber(after)) continue;

    if (start > cursor) {
      headlineElement.append(document.createTextNode(title.slice(cursor, start)));
    }

    const matchEl = document.createElement("span");
    matchEl.className = "match";
    matchEl.textContent = title.slice(start, end);
    headlineElement.append(matchEl);

    cursor = end;
    renderedAny = true;
  }

  if (!renderedAny) {
    headlineElement.textContent = title;
    return;
  }

  if (cursor < title.length) headlineElement.append(document.createTextNode(title.slice(cursor)));
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

function renderMeta(metaElement, formattedDate, sourceLabel, url, index, total, onPrev, onNext) {
  metaElement.replaceChildren();

  const left = document.createElement("span");
  left.className = "meta-left";

  if (formattedDate) {
    const date = document.createElement("span");
    date.className = "meta-date";
    date.textContent = formattedDate;
    left.append(date);
  }

  if (sourceLabel) {
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = sourceLabel;
      left.append(a);
    } else {
      const source = document.createElement("span");
      source.className = "meta-source";
      source.textContent = sourceLabel;
      left.append(source);
    }
  }

  metaElement.append(left);

  const nav = document.createElement("span");
  nav.className = "meta-nav";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "nav-btn";
  prev.textContent = "<";
  prev.disabled = total <= 1;
  prev.setAttribute("aria-label", "Previous headline");
  prev.addEventListener("click", onPrev);
  nav.append(prev);

  const count = document.createElement("span");
  count.className = "nav-count";

  const countIndex = document.createElement("span");
  countIndex.className = "nav-index";
  countIndex.textContent = String(index);

  const countSep = document.createElement("span");
  countSep.className = "nav-sep";
  countSep.setAttribute("aria-hidden", "true");

  const countTotal = document.createElement("span");
  countTotal.className = "nav-total";
  countTotal.textContent = String(total);

  count.append(countIndex, countSep, countTotal);
  nav.append(count);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "nav-btn";
  next.textContent = ">";
  next.disabled = total <= 1;
  next.setAttribute("aria-label", "Next headline");
  next.addEventListener("click", onNext);
  nav.append(next);

  metaElement.append(nav);
}

function showActivePick() {
  const pick = activeMatches[activeIndex];
  if (!pick) return;

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
  renderHeadlineWithQuery(headlineEl, pick.title, activeWord);
  renderMeta(
    metaEl,
    formattedDate,
    sourceLabel,
    pick.url || "",
    activeIndex + 1,
    activeMatches.length,
    () => {
      if (activeMatches.length <= 1) return;
      activeIndex = (activeIndex - 1 + activeMatches.length) % activeMatches.length;
      showActivePick();
    },
    () => {
      if (activeMatches.length <= 1) return;
      activeIndex = (activeIndex + 1) % activeMatches.length;
      showActivePick();
    }
  );
}

async function fetchHeadline(word) {
  headlineEl.textContent = "Loading...";
  metaEl.replaceChildren();

  try {
    const headlines = await loadHeadlines();
    const matches = headlines.filter((item) => matchesHeadline(item, word));

    if (matches.length === 0) {
      activeWord = "";
      activeMatches = [];
      activeIndex = -1;
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

    activeWord = word;
    activeMatches = matches;
    activeIndex = Math.floor(Math.random() * activeMatches.length);
    showActivePick();
  } catch (err) {
    console.error(err);
    headlineEl.textContent = "Couldn't load the headline database.";
  }
}
