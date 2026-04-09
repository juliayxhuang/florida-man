// ============================================
// 🔑 PASTE YOUR KEYS HERE
// ============================================
const API_KEY = "AIzaSyDaeZXTZG25hJGzFQznQ0b4AFCFtjk2ycw";
const SEARCH_ENGINE_ID = "3162d13ac253d4fed";
// ============================================

function populateDays() {
  const month = document.getElementById('month').value;
  const daysInMonth = new Date(2024, new Date(month + ' 1').getMonth() + 1, 0).getDate();
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

document.getElementById('month').addEventListener('change', populateDays);
populateDays();

async function search() {
  const month = document.getElementById('month').value;
  const day = document.getElementById('day').value;
  const resultEl = document.getElementById('result');

  resultEl.innerHTML = '<p>Loading...</p>';

  const query = `Florida Man ${month} ${day}`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      resultEl.innerHTML = `<p>Error: ${data.error.message}</p>`;
      return;
    }

    if (!data.items || data.items.length === 0) {
      resultEl.innerHTML = `<p>No results found for ${month} ${day}.</p>`;
      return;
    }

    resultEl.innerHTML = data.items.map(item => `
      <div class="result-item">
        <a href="${item.link}" target="_blank">${item.title}</a>
        <p>${item.snippet}</p>
      </div>
    `).join('');

  } catch (err) {
    resultEl.innerHTML = `<p>Something went wrong: ${err.message}</p>`;
  }
}