// ============================================
// 🔑 GNEWS API KEY
// ============================================
const GNEWS_API_KEY = "713c26ac745896e22b7df976f996c2f7";
// ============================================

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

let selectedYear  = new Date().getFullYear();
let selectedMonth = new Date().getMonth(); // 0-indexed
let selectedDay   = new Date().getDate();

// ── Build year dropdown ──
function buildYearSelect() {
  const el = document.getElementById('year');
  const current = new Date().getFullYear();
  for (let y = 2000; y <= current; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === current) opt.selected = true;
    el.appendChild(opt);
  }
  el.value = selectedYear;
  el.addEventListener('change', () => {
    selectedYear = parseInt(el.value);
    renderDays();
  });
}

// ── Build month strip ──
function buildMonths() {
  const el = document.getElementById('cal-months');
  MONTHS.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'cal-month' + (i === selectedMonth ? ' selected' : '');
    div.textContent = m;
    div.addEventListener('click', () => {
      selectedMonth = i;
      // clamp day to valid range
      const max = daysInMonth(selectedYear, selectedMonth);
      if (selectedDay > max) selectedDay = max;
      document.querySelectorAll('.cal-month').forEach((el, idx) => {
        el.classList.toggle('selected', idx === selectedMonth);
      });
      renderDays();
    });
    el.appendChild(div);
  });
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ── Render day grid ──
function renderDays() {
  const el = document.getElementById('cal-days');
  el.innerHTML = '';

  const firstDow = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun
  const total = daysInMonth(selectedYear, selectedMonth);

  // empty cells before day 1
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    el.appendChild(blank);
  }

  for (let d = 1; d <= total; d++) {
    const div = document.createElement('div');
    div.className = 'cal-day' + (d === selectedDay ? ' selected' : '');
    div.textContent = d;
    div.addEventListener('click', () => {
      selectedDay = d;
      document.querySelectorAll('.cal-day:not(.empty)').forEach((el, idx) => {
        el.classList.toggle('selected', idx + 1 === selectedDay);
      });
    });
    el.appendChild(div);
  }
}

// ── Search ──
async function search() {
  const headlineEl = document.getElementById('headline-text');
  const sourceEl   = document.getElementById('headline-source');

  headlineEl.classList.add('loading');
  headlineEl.innerHTML = 'Loading...';
  sourceEl.style.display = 'none';

  const url = `https://gnews.io/api/v4/search?q=%22florida+man%22&lang=en&token=${GNEWS_API_KEY}&max=10&sortby=publishedAt`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    headlineEl.classList.remove('loading');

    if (data.errors) {
      headlineEl.textContent = `Error: ${data.errors}`;
      return;
    }

    if (!data.articles || data.articles.length === 0) {
      headlineEl.textContent = 'No Florida Man headlines found. Try again.';
      return;
    }

    // filter to only real Florida Man titles
    const filtered = data.articles.filter(a =>
      a.title.toLowerCase().includes('florida man') ||
      a.title.toLowerCase().includes('florida woman')
    );

    const pool = filtered.length > 0 ? filtered : data.articles;
    const article = pool[Math.floor(Math.random() * pool.length)];

    headlineEl.textContent = article.title;

    const pubDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
    sourceEl.innerHTML = `${pubDate} &nbsp;·&nbsp; <a href="${article.url}" target="_blank" rel="noopener">${article.source.name}</a>`;
    sourceEl.style.display = 'block';

  } catch (err) {
    headlineEl.classList.remove('loading');
    headlineEl.textContent = `Something went wrong: ${err.message}`;
  }
}

// ── Init ──
buildYearSelect();
buildMonths();
renderDays();