# Headline Maintenance Brief

This project uses a static headline database at `data/headlines.json`. The search page loads that JSON directly in the browser, so it works on GitHub Pages, Vercel, and local static servers without Reddit credentials or a backend API.

## Current Dataset

As of the last update:

- Count: `10000`
- Newest date: `2026-04-23`
- Oldest date: `2021-04-10`
- Source: GDELT DOC 2.0 article index

Each item should look like:

```json
{
  "title": "Florida man ...",
  "url": "https://...",
  "source": "example.com",
  "date": "2024-01-01",
  "image": "https://...",
  "keywords": ["florida", "arrested", "police"]
}
```

## How The Updater Works

The updater is:

```bash
scripts/update-headlines-gdelt.mjs
```

It:

1. Loads the existing `data/headlines.json`.
2. Dedupe-checks by URL and title.
3. Fetches real article results from GDELT.
4. Keeps only titles containing `Florida man` or `Florida woman`.
5. Adds new items until it reaches the target count.
6. Rewrites `data/headlines.json`.

## Command Format

```bash
node scripts/update-headlines-gdelt.mjs TARGET_COUNT MAX_DAYS_BACK START_DATE END_DATE
```

Examples:

```bash
node scripts/update-headlines-gdelt.mjs 11000 0 2021-01-01 2021-04-09
node scripts/update-headlines-gdelt.mjs 12000 0 2020 2020
node scripts/update-headlines-gdelt.mjs 13000 0 2019-01-01 2019-12-31
```

If `START_DATE` and `END_DATE` are provided, `MAX_DAYS_BACK` is ignored. Use `0` for that argument in targeted runs.

## Recommended Future Expansion

Since the dataset currently reaches back to `2021-04-10`, the next efficient run is:

```bash
node scripts/update-headlines-gdelt.mjs 11000 0 2021-01-01 2021-04-09
```

If that range does not reach 11,000, continue into 2020:

```bash
node scripts/update-headlines-gdelt.mjs 11000 0 2020 2020
```

For the next batch after that, raise the target:

```bash
node scripts/update-headlines-gdelt.mjs 12000 0 2020 2020
```

## After Running

Verify the count:

```bash
node -e "const d=require('./data/headlines.json'); console.log({count:d.count,length:d.items.length,newest:d.items[0].date,oldest:d.items.at(-1).date})"
```

Commit and push:

```bash
git add data/headlines.json
git commit -m "Expand sourced headlines to 11000"
git push origin main
```

## Notes

- GDELT sometimes times out, rate-limits, or briefly fails DNS. The script skips failed windows and keeps going.
- If a run misses a date window because of a network error, rerun the same targeted command later. Deduping prevents duplicates.
- The JSON can keep growing, but larger files increase page load size. `10000` is already a strong dataset; `15000` to `20000` is probably still manageable, but test page load after each large jump.
- Do not scrape Reddit directly. This dataset avoids Reddit API/credential issues by using saved real-source article metadata from GDELT.
