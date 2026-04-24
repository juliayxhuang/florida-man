const input = document.getElementById("wordInput");
const headlineEl = document.getElementById("headline");
const metaEl = document.getElementById("meta");
const linkEl = document.getElementById("link");
const VERCEL_API_ORIGIN = "";

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const value = input.value.trim();

    // ❌ too many words
    if (value.split(" ").length > 1) {
      headlineEl.textContent = "Too many words.";
      metaEl.textContent = "";
      linkEl.textContent = "";
      return;
    }

    if (!value) return;

    fetchHeadline(value);
  }
});

async function fetchHeadline(word) {
  headlineEl.textContent = "Loading...";
  metaEl.textContent = "";
  linkEl.textContent = "";

  try {
    const params = new URLSearchParams({ word });
    const apiPath = `/api/reddit-search?${params.toString()}`;
    const sameOriginUrl = apiPath;
    const vercelProxyUrl = VERCEL_API_ORIGIN
      ? `${VERCEL_API_ORIGIN.replace(/\/$/, "")}${apiPath}`
      : "";
    const apiHost = window.location.hostname || "localhost";
    const localProxyUrl = `http://${apiHost}:3000/api/reddit-search?${params.toString()}`;

    const urls = [];
    const isLocalDevServer = window.location.port === "3000";
    const isLiveServer = window.location.port === "5500";
    const isGithubPages = window.location.hostname.endsWith("github.io");

    if (vercelProxyUrl && isGithubPages) urls.push(vercelProxyUrl);
    if (!isLiveServer) urls.push(sameOriginUrl);
    if (isLocalDevServer || isLiveServer) urls.push(localProxyUrl);
    if (vercelProxyUrl && !urls.includes(vercelProxyUrl)) urls.push(vercelProxyUrl);

    let res = null;
    let lastError = null;
    for (const url of urls) {
      try {
        res = await fetch(url);
        if (res.ok) break;
        lastError = new Error(`Proxy request failed (${res.status})`);
      } catch (err) {
        lastError = err;
      }
    }
    if (!res || !res.ok) throw lastError || new Error("Proxy request failed");

    const data = await res.json();

    let posts = data?.data?.children || [];

    // filter titles that actually include the word
    posts = posts.filter(p =>
      p.data.title.toLowerCase().includes(word.toLowerCase())
    );

    // fallback
    if (posts.length === 0) {
      headlineEl.textContent = "Couldn't find that word, but here's a random headline.";
      posts = data?.data?.children || [];
    }

    if (!posts || posts.length === 0) {
      headlineEl.textContent = "Florida Man is being chaotic right now.";
      return;
    }

    const randomPost = posts[Math.floor(Math.random() * posts.length)];

    const title = randomPost.data.title;
    const createdUTC = randomPost.data.created_utc;
    const postUrl = randomPost.data.url;

    // DATE
    const date = new Date(createdUTC * 1000);
    const formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // "PUBLISHER" from domain
    let publisher = "UNKNOWN SOURCE";
    try {
      const domain = new URL(postUrl).hostname.replace("www.", "");
      publisher = domain.toUpperCase();
    } catch {}

    // UPDATE UI
    headlineEl.textContent = title;
    metaEl.textContent = `${formattedDate} · ${publisher}`;
    linkEl.href = postUrl;
    linkEl.textContent = "READ ARTICLE";

  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err || "");
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      headlineEl.textContent = "Can’t reach the API server. Run npm start locally, or deploy this project to Vercel.";
    } else {
      headlineEl.textContent = "Florida Man is being chaotic right now.";
    }
  }
}
