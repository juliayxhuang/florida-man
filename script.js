const input = document.getElementById("wordInput");
const resultArea = document.getElementById("resultArea");
const headline = document.getElementById("headline");
const meta = document.getElementById("meta");
const errorArea = document.getElementById("errorArea");
const errorMsg = document.getElementById("errorMsg");

const GUARDIAN_API_KEY = "YOUR_API_KEY_HERE"; // drop your key in here

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const word = input.value.trim();
    if (!word) return;
    await search(word);
  }
});

async function search(word) {
  hide(resultArea);
  hide(errorArea);
  showLoading(true);

  try {
    // Fetch a big pool of real "florida man" articles
    const pool = await fetchFloridaManPool();

    if (!pool || pool.length === 0) {
      showLoading(false);
      showError("Something went wrong. Try again.");
      return;
    }

    // Try to find one whose headline contains the user's word
    const wordLower = word.toLowerCase();
    const matched = pool.filter(a => {
      const title = (a.fields?.headline || a.webTitle).toLowerCase();
      return title.includes(wordLower);
    });

    const isFallback = matched.length === 0;
    const article = isFallback
      ? pool[Math.floor(Math.random() * pool.length)]
      : matched[Math.floor(Math.random() * matched.length)];

    const title = article.fields?.headline || article.webTitle;
    const date = formatDate(article.webPublicationDate);
    const url = article.webUrl;

    headline.textContent = isFallback
      ? `Couldn't find "${word}" — but here's one anyway: ${title}`
      : title;

    meta.innerHTML = `${date} · The Guardian · <a href="${url}" target="_blank" rel="noopener">source</a>`;

    showLoading(false);
    show(resultArea);

  } catch (err) {
    console.error(err);
    showLoading(false);
    showError("Something went wrong. Try again.");
  }
}

async function fetchFloridaManPool() {
  // Randomly offset page so we get variety across searches
  const page = Math.floor(Math.random() * 5) + 1;
  const url = `https://content.guardianapis.com/search?q=%22florida+man%22&api-key=${GUARDIAN_API_KEY}&show-fields=headline&page-size=50&order-by=newest&page=${page}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.response?.status !== "ok") return null;

  // Only keep articles whose headline actually contains "florida man" or "florida woman"
  return (data.response.results || []).filter(a => {
    const title = (a.fields?.headline || a.webTitle).toLowerCase();
    return title.includes("florida man") || title.includes("florida woman");
  });
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function showLoading(on) {
  input.style.opacity = on ? "0.4" : "1";
  input.disabled = on;
}

function showError(msg) {
  errorMsg.textContent = msg;
  show(errorArea);
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }