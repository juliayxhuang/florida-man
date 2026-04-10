// ============================================
// 🔑 GNEWS API KEY
// ============================================
const GNEWS_API_KEY = "713c26ac745896e22b7df976f996c2f7";
// ============================================

function populateYears() {
  const yearEl = document.getElementById('year');
  const currentYear = new Date().getFullYear();
  for (let y = 2000; y <= currentYear; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    yearEl.appendChild(opt);
  }
}

function populateDays() {
  const year = document.getElementById('year').value;
  const month = document.getElementById('month').value;
  const daysInMonth = new Date(year, new Date(month + ' 1').getMonth() + 1, 0).getDate();
  const dayEl = document.getElementById('day');
  const current = parseInt(dayEl.value) || 1;
  dayEl.innerHTML = '';
  for (let i = 1; i <= daysInMonth; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    if (i === current) opt.selected = true;
    dayEl.appendChild(opt);
  }
}

document.getElementById('year').addEventListener('change', populateDays);
document.getElementById('month').addEventListener('change', populateDays);
populateYears();
populateDays();

async function search() {
  const year = document.getElementById('year').value;
  const month = document.getElementById('month').value;
  const day = document.getElementById('day').value;
  const resultEl = document.getElementById('result');

  resultEl.innerHTML = '<p>Loading...</p>';

  // Convert month name to search-friendly format
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthIndex = monthNames.indexOf(month) + 1;
  const dateStr = `${year}-${monthIndex.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  // GNews API - simple search without date filters first
  const url = `https://gnews.io/api/v4/search?q="florida%20man"&sortby=publishedAt&lang=en&token=${GNEWS_API_KEY}&max=50`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.errors) {
      resultEl.innerHTML = `<p>Error: ${data.errors}</p>`;
      return;
    }

    if (!data.articles || data.articles.length === 0) {
      resultEl.innerHTML = `<p>No articles found for "florida man".</p>`;
      return;
    }

    // Pick a random article
    const randomIndex = Math.floor(Math.random() * data.articles.length);
    const article = data.articles[randomIndex];
    const headline = article.title;
    const source = article.source.name;
    const pubDate = new Date(article.publishedAt).toLocaleDateString();
    resultEl.innerHTML = `<p><strong>Headline:</strong> ${headline}</p><p><small>Source: ${source} | Date: ${pubDate}</small></p>`;

  } catch (err) {
    resultEl.innerHTML = `<p>Something went wrong: ${err.message}</p>`;
  }
}