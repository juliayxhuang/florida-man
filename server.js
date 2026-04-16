const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('.'));

const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || 'fd1cc3c4-5ad5-45b1-9643-4e820b0670cb';
const NYT_API_KEY = process.env.NYT_API_KEY || 'QcXWGIgY96ePhFxEjIzciS360S43YTdxd2Reqiqrjxn4bae1';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '713c26ac745896e22b7df976f996c2f7';

const CURRENT_YEAR = new Date().getFullYear();
const MODERN_MIN_YEAR = 1990;
const ARCHIVE_MAX_YEAR = 1963;
const ARCHIVE_MIN_YEAR = 1900;
const YEAR_BATCH_SIZE = 5;
const REQUEST_TIMEOUT_MS = 3500;
const MODERN_LOOKBACK_YEARS = 20;

const sourceState = {
  nyt: { disabledUntil: 0 },
  gnews: { disabledUntil: 0 },
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildIsoDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function buildCompactDate(year, month, day) {
  return `${year}${pad(month)}${pad(day)}`;
}

function normalizeText(value) {
  return (value || '').toLowerCase();
}

function looksLikeFloridaMan(text) {
  const normalized = normalizeText(text);

  if (!normalized.includes('florida')) {
    return false;
  }

  return (
    normalized.includes('florida man') ||
    normalized.includes('florida men') ||
    normalized.includes('florida woman') ||
    normalized.includes('florida women') ||
    normalized.includes('florida person') ||
    ((normalized.includes('man') || normalized.includes('woman')) &&
      (normalized.includes('arrest') ||
        normalized.includes('police') ||
        normalized.includes('charged') ||
        normalized.includes('accused') ||
        normalized.includes('stole') ||
        normalized.includes('crime')))
  );
}

function parseDateParts(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function isExactMonthDay(dateString, month, day, year) {
  const parts = parseDateParts(dateString);

  if (!parts) {
    return false;
  }

  return parts.year === year && parts.month === month && parts.day === day;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.json();
}

function sourceIsDisabled(sourceKey) {
  return Date.now() < (sourceState[sourceKey]?.disabledUntil || 0);
}

function disableSourceTemporarily(sourceKey, ms) {
  if (!sourceState[sourceKey]) {
    return;
  }

  sourceState[sourceKey].disabledUntil = Date.now() + ms;
}

function isRateLimitError(error) {
  return error.message.includes('HTTP 429');
}

async function searchGuardian(month, day, year) {
  if (!GUARDIAN_API_KEY) {
    return [];
  }

  const date = buildIsoDate(year, month, day);
  const url =
    `https://content.guardianapis.com/search?q=florida` +
    `&from-date=${date}` +
    `&to-date=${date}` +
    `&page-size=50` +
    `&api-key=${GUARDIAN_API_KEY}`;

  try {
    const data = await fetchJson(url);
    const results = data.response?.results || [];

    return results
      .filter((article) => looksLikeFloridaMan(article.webTitle))
      .map((article) => ({
        title: article.webTitle,
        date: article.webPublicationDate,
        url: article.webUrl,
        source: 'The Guardian',
      }));
  } catch (error) {
    console.error(`Guardian search failed for ${date}:`, error.message);
    return [];
  }
}

async function searchNYT(month, day, year) {
  if (!NYT_API_KEY) {
    return [];
  }

  if (sourceIsDisabled('nyt')) {
    return [];
  }

  const date = buildCompactDate(year, month, day);
  const params = new URLSearchParams({
    q: '"florida man" OR "florida woman"',
    begin_date: date,
    end_date: date,
    sort: 'newest',
    'api-key': NYT_API_KEY,
  });
  const url = `https://api.nytimes.com/svc/search/v2/articlesearch.json?${params.toString()}`;

  try {
    const data = await fetchJson(url);
    const docs = data.response?.docs || [];

    return docs
      .filter((article) => looksLikeFloridaMan(article.headline?.main || article.abstract))
      .map((article) => ({
        title: article.headline?.main || article.abstract || 'Florida Man',
        date: article.pub_date,
        url: article.web_url,
        source: 'The New York Times',
      }));
  } catch (error) {
    if (isRateLimitError(error)) {
      disableSourceTemporarily('nyt', 10 * 60 * 1000);
    }
    console.error(`NYT search failed for ${date}:`, error.message);
    return [];
  }
}

async function searchGNews(month, day, year) {
  if (!GNEWS_API_KEY) {
    return [];
  }

  if (sourceIsDisabled('gnews')) {
    return [];
  }

  const date = buildIsoDate(year, month, day);
  const from = `${date}T00:00:00Z`;
  const to = `${date}T23:59:59Z`;
  const params = new URLSearchParams({
    q: '"florida man" OR "florida woman"',
    from,
    to,
    lang: 'en',
    max: '10',
    sortby: 'publishedAt',
    token: GNEWS_API_KEY,
  });
  const url = `https://gnews.io/api/v4/search?${params.toString()}`;

  try {
    const data = await fetchJson(url);
    const articles = data.articles || [];

    return articles
      .filter((article) => looksLikeFloridaMan(`${article.title} ${article.description || ''}`))
      .map((article) => ({
        title: article.title,
        date: article.publishedAt,
        url: article.url,
        source: article.source?.name || 'GNews',
      }));
  } catch (error) {
    if (isRateLimitError(error)) {
      disableSourceTemporarily('gnews', 10 * 60 * 1000);
    }
    console.error(`GNews search failed for ${date}:`, error.message);
    return [];
  }
}

async function searchLibraryOfCongress(month, day, year) {
  const params = new URLSearchParams({
    fo: 'json',
    q: '"florida man" OR "florida woman"',
    c: '50',
    dates: `${year}/${year}`,
    sb: 'date_desc',
  });
  const url = `https://www.loc.gov/collections/chronicling-america/?${params.toString()}`;

  try {
    const data = await fetchJson(url);
    const results = data.results || [];

    return results
      .map((item) => {
        const title = item.title || item.item?.title || item.subject?.[0] || 'Florida Man archive result';
        const date = item.date || item.item?.date || null;
        const url = item.id || item.url || item.item?.id || null;

        return {
          title,
          date,
          url,
          source: 'Library of Congress',
        };
      })
      .filter((article) => article.date && article.url)
      .filter((article) => isExactMonthDay(article.date, month, day, year))
      .filter((article) => looksLikeFloridaMan(article.title));
  } catch (error) {
    console.error(`Library of Congress search failed for ${year}:`, error.message);
    return [];
  }
}

async function searchModernYear(month, day, year) {
  const [guardianMatches, nytMatches, gnewsMatches] = await Promise.all([
    searchGuardian(month, day, year),
    searchNYT(month, day, year),
    searchGNews(month, day, year),
  ]);

  const orderedMatches = [guardianMatches, nytMatches, gnewsMatches];

  for (const matches of orderedMatches) {
    if (matches.length > 0) {
      return pickRandom(matches);
    }
  }

  return null;
}

async function searchArchiveYears(month, day) {
  for (let year = ARCHIVE_MAX_YEAR; year >= ARCHIVE_MIN_YEAR; year -= 1) {
    const matches = await searchLibraryOfCongress(month, day, year);

    if (matches.length > 0) {
      return pickRandom(matches);
    }
  }

  return null;
}

function buildYearBatches(startYear, endYear, batchSize) {
  const batches = [];

  for (let year = startYear; year >= endYear; year -= batchSize) {
    const batch = [];

    for (let offset = 0; offset < batchSize; offset += 1) {
      const candidateYear = year - offset;
      if (candidateYear >= endYear) {
        batch.push(candidateYear);
      }
    }

    batches.push(batch);
  }

  return batches;
}

async function searchModernYears(month, day) {
  const minYear = Math.max(MODERN_MIN_YEAR, CURRENT_YEAR - MODERN_LOOKBACK_YEARS);
  const yearBatches = buildYearBatches(CURRENT_YEAR, minYear, YEAR_BATCH_SIZE);

  for (const batch of yearBatches) {
    const batchResults = await Promise.all(
      batch.map(async (year) => ({
        year,
        article: await searchModernYear(month, day, year),
      }))
    );

    const match = batchResults.find((result) => result.article);

    if (match) {
      return match;
    }
  }

  return null;
}

app.get('/api/florida-man', async (req, res) => {
  const month = Number.parseInt(req.query.month, 10);
  const day = Number.parseInt(req.query.day, 10);
  const includeArchive = req.query.includeArchive === '1';

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Month must be between 1 and 12.' });
  }

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return res.status(400).json({ error: 'Day must be between 1 and 31.' });
  }

  try {
    const modernMatch = await searchModernYears(month, day);

    if (modernMatch) {
      return res.json({
        article: modernMatch.article,
        matchedYear: modernMatch.year,
      });
    }

    if (!includeArchive) {
      return res.status(404).json({
        error: 'No Florida Man headline found in modern sources for that month and day.',
      });
    }

    const archiveArticle = await searchArchiveYears(month, day);

    if (archiveArticle) {
      return res.json({
        article: archiveArticle,
        matchedYear: parseDateParts(archiveArticle.date)?.year || null,
      });
    }

    return res.status(404).json({
      error: 'No Florida Man headline found for that month and day, including archive search.',
    });
  } catch (error) {
    console.error('Florida Man search failed:', error.message);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
