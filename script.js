const input = document.getElementById("wordInput");
const resultArea = document.getElementById("resultArea");
const headline = document.getElementById("headline");
const meta = document.getElementById("meta");
const errorArea = document.getElementById("errorArea");
const errorMsg = document.getElementById("errorMsg");

// Search on Enter
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

  try {
    // First try: search with the word AND filter titles to contain it
    let post = await fetchPost(`Florida Man ${word}`, word);

    // Fallback: no match found, grab any random Florida Man post
    if (!post) {
      post = await fetchPost("Florida Man");
      if (post) {
        // Prepend a note to the headline
        post._fallback = true;
      }
    }

    if (!post) {
      showError("Something went wrong. Try again.");
      return;
    }

    const title = post.data.title;
    const permalink = post.data.permalink;
    const created = post.data.created_utc;
    const date = formatDate(created);
    const redditUrl = `https://www.reddit.com${permalink}`;
    const articleUrl = post.data.url || null;
    const publisher = extractPublisher(articleUrl);

    headline.textContent = post._fallback
      ? `Couldn't find "${word}" — but here's one anyway: ${title}`
      : title;

    let metaParts = [];
    if (date) metaParts.push(date);
    if (publisher) metaParts.push(publisher);

    if (articleUrl && articleUrl !== redditUrl) {
      meta.innerHTML = metaParts.join(" · ") + (metaParts.length ? " · " : "") + `<a href="${articleUrl}" target="_blank" rel="noopener">source</a>`;
    } else {
      meta.innerHTML = metaParts.join(" · ") + (metaParts.length ? " · " : "") + `<a href="${redditUrl}" target="_blank" rel="noopener">reddit post</a>`;
    }

    show(resultArea);

  } catch (err) {
    console.error(err);
    showError("Something went wrong. Try again.");
  }
}

async function fetchPost(query, filterWord = null) {
  const url = `https://www.reddit.com/r/FloridaMan/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  const posts = data?.data?.children;

  if (!posts || posts.length === 0) return null;

  let filtered = posts.filter(p => !p.data.stickied && p.data.title.length > 10);

  // If a specific word is required, filter to only posts whose title contains it
  if (filterWord) {
    const wordLower = filterWord.toLowerCase();
    const wordMatches = filtered.filter(p => p.data.title.toLowerCase().includes(wordLower));
    if (wordMatches.length > 0) filtered = wordMatches;
    else return null; // signal no match found
  }

  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function formatDate(utc) {
  if (!utc) return null;
  const d = new Date(utc * 1000);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function extractPublisher(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname;
  } catch {
    return null;
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  show(errorArea);
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }