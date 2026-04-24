const input = document.getElementById("wordInput");
const headlineEl = document.getElementById("headline");
const metaEl = document.getElementById("meta");
const linkEl = document.getElementById("link");

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
    const res = await fetch(`/api/reddit-search?${params.toString()}`);
    if (!res.ok) throw new Error(`Proxy request failed (${res.status})`);

    const data = await res.json();
    const isFallback = data?.source === "bundled-fallback";
    const posts = data?.data?.children || [];

    // filter titles that actually include the word
    const matchingPosts = posts.filter(p =>
      p.data.title.toLowerCase().includes(word.toLowerCase())
    );

    // fallback
    if (matchingPosts.length === 0) {
      headlineEl.textContent = isFallback
        ? `No saved headline found for "${word}". Try meth, pizza, car, or alligator.`
        : `Couldn't find "${word}", but try another word.`;
      return;
    }

    const randomPost = matchingPosts[Math.floor(Math.random() * matchingPosts.length)];

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
