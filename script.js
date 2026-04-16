const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const GUARDIAN_API_KEY = "fd1cc3c4-5ad5-45b1-9643-4e820b0670cb";
let lastSearchMode = 'guardian-direct';
let backendAvailable = true;
const resultCache = new Map();

function getApiBaseUrl() {
  const { protocol, hostname, port } = window.location;

  // When the page is served by a static dev server like Live Server,
  // send API requests to the Express backend instead of the static origin.
  if ((hostname === '127.0.0.1' || hostname === 'localhost') && port === '5500') {
    return `${protocol}//localhost:3000`;
  }

  return '';
}

function getCacheKey(monthNum, dayNum) {
  return `${monthNum}-${dayNum}`;
}

function readCachedResult(monthNum, dayNum) {
  const key = getCacheKey(monthNum, dayNum);
  const memoryResult = resultCache.get(key);

  if (memoryResult) {
    return memoryResult;
  }

  try {
    const stored = window.localStorage.getItem(`florida-man:${key}`);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    resultCache.set(key, parsed);
    return parsed;
  } catch (err) {
    console.warn('Could not read cached result:', err.message);
    return null;
  }
}

function writeCachedResult(monthNum, dayNum, result) {
  const key = getCacheKey(monthNum, dayNum);
  resultCache.set(key, result);

  try {
    window.localStorage.setItem(`florida-man:${key}`, JSON.stringify(result));
  } catch (err) {
    console.warn('Could not save cached result:', err.message);
  }
}

let selectedYear  = new Date().getFullYear();
let selectedMonth = new Date().getMonth(); // 0-indexed
let selectedDay   = new Date().getDate();

// ── Build year dropdown ──
function buildYearSelect() {
  // Year selector removed - auto-searches backwards from current year
  selectedYear = new Date().getFullYear();
}

// ── Build month strip ──
function buildMonths() {
  const el = document.getElementById('cal-months');
  console.log('Building months, element:', el);
  if (!el) {
    console.error('❌ cal-months element not found!');
    return;
  }
  MONTHS.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'cal-month' + (i === selectedMonth ? ' selected' : '');
    div.textContent = m;
    div.addEventListener('click', () => {
      selectedMonth = i;
      console.log(`📅 Month changed to ${MONTH_NAMES[selectedMonth]}`);
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
  console.log('✅ Months built');
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

// ── Search backend ──
async function searchFloridaMan(monthNum, dayNum) {
  if (!backendAvailable) {
    throw new Error('Backend unavailable');
  }

  const params = new URLSearchParams({
    month: monthNum.toString(),
    day: dayNum.toString()
  });

  const apiUrl = `${getApiBaseUrl()}/api/florida-man?${params.toString()}`;
  let res;

  try {
    res = await fetch(apiUrl);
  } catch (err) {
    backendAvailable = false;
    throw new Error('Backend unavailable');
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : { error: 'The backend did not return JSON. Make sure the Express server is running.' };

  if (!res.ok) {
    if (res.status >= 500 || res.status === 404) {
      backendAvailable = false;
    }
    throw new Error(data.error || 'Search failed');
  }

  backendAvailable = true;
  return data;
}

async function searchGuardianDirect(monthNum, dayNum) {
  const cachedResult = readCachedResult(monthNum, dayNum);
  if (cachedResult) {
    return cachedResult;
  }

  const currentYear = new Date().getFullYear();

  for (let year = currentYear; year >= 1990; year--) {
    const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    const url = `https://content.guardianapis.com/search?q=florida&from-date=${dateStr}&to-date=${dateStr}&api-key=${GUARDIAN_API_KEY}&page-size=50`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const articles = data.response?.results || [];

      const filtered = articles.filter(article => {
        const title = (article.webTitle || '').toLowerCase();
        return (
          title.includes('florida man') ||
          title.includes('florida men') ||
          title.includes('florida woman') ||
          title.includes('florida women') ||
          (title.includes('florida') &&
            (title.includes('man') ||
             title.includes('woman') ||
             title.includes('arrested') ||
             title.includes('charged') ||
             title.includes('police')))
        );
      });

      if (filtered.length > 0) {
        const article = filtered[Math.floor(Math.random() * filtered.length)];
        const result = {
          article: {
            title: article.webTitle,
            date: article.webPublicationDate,
            url: article.webUrl,
            source: 'The Guardian'
          },
          matchedYear: year
        };

        writeCachedResult(monthNum, dayNum, result);
        return result;
      }
    } catch (err) {
      console.error(`Guardian direct search failed for ${dateStr}:`, err.message);
      throw new Error('Guardian request failed or was rate-limited.');
    }
  }

  throw new Error('No Florida Man headlines found for that date.');
}

// ── Search ──
async function search() {
  const headlineEl = document.getElementById('headline-text');
  const sourceEl   = document.getElementById('headline-source');

  headlineEl.classList.add('loading');
  headlineEl.innerHTML = 'Loading...';
  sourceEl.style.display = 'none';
  lastSearchMode = 'guardian-direct';

  const monthNum = selectedMonth + 1;
  const dayNum = selectedDay;
  console.log(`🔍 Searching for ${MONTH_NAMES[selectedMonth]} ${dayNum} articles...`);

  try {
    let result;

    try {
      result = await searchGuardianDirect(monthNum, dayNum);
      lastSearchMode = 'guardian-direct';
    } catch (err) {
      console.warn('Guardian direct search failed, trying backend fallback:', err.message);

      try {
        result = await searchFloridaMan(monthNum, dayNum);
        lastSearchMode = 'backend';
        writeCachedResult(monthNum, dayNum, result);
      } catch (backendErr) {
        throw new Error(
          backendErr.message === 'Backend unavailable'
            ? 'Guardian was blocked or rate-limited, and the backend server is not running on localhost:3000.'
            : backendErr.message === 'No Florida Man headline found in modern sources for that month and day.'
              ? 'No Florida Man headline found quickly for that date.'
              : backendErr.message
        );
      }
    }

    const article = result.article;
    const title = article.title || "Florida Man";
    const dateStr = article.date;
    const source = article.source || "Unknown source";

    headlineEl.classList.remove('loading');
    headlineEl.textContent = title;

    const pubDate = new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    const modeNote = lastSearchMode === 'guardian-direct'
      ? ' &nbsp;·&nbsp; <span>Guardian mode</span>'
      : ' &nbsp;·&nbsp; <span>Backend fallback mode</span>';

    sourceEl.innerHTML = `${pubDate} &nbsp;·&nbsp; <a href="${article.url}" target="_blank" rel="noopener">${source}</a>${modeNote}`;
    sourceEl.style.display = 'block';

    console.log(`✅ Found article from ${result.matchedYear}:`);
    console.log(`   Title: ${title}`);
    console.log(`   Source: ${source}`);
  } catch (err) {
    headlineEl.classList.remove('loading');
    headlineEl.textContent = `No Florida Man headlines found for ${MONTH_NAMES[selectedMonth]} ${dayNum} in any year. Try another date.`;
    sourceEl.style.display = 'none';
    console.error(`❌ Search failed for ${MONTH_NAMES[selectedMonth]} ${dayNum}:`, err.message);
  }
}

// ── Init ──
console.log(`📅 Florida Man Calendar ready - select month and day to find articles`);
buildYearSelect();
buildMonths();
renderDays();
