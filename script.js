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
    const query = encodeURIComponent(`Florida Man ${word}`);
    const url = `https://www.reddit.com/r/FloridaMan/search.json?q=${query}&restrict_sr=1&sort=relevance&limit=25`;
    const res = await fetch(url);
    const data = await res.json();

    let posts = data.data.children;

    // filter titles that actually include the word
    posts = posts.filter(p =>
      p.data.title.toLowerCase().includes(word.toLowerCase())
    );

    // fallback
    if (posts.length === 0) {
      headlineEl.textContent = "Couldn't find that word, but here's a random headline.";
      posts = data.data.children;
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
    headlineEl.textContent = "Florida Man is being chaotic right now.";
  }
}