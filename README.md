# Florida Man

Static Florida Man headline search and bingo pages powered by a saved real-source headline dataset.

## Pages

- `index.html` - keyword headline search
- `keyword/word.html` - alternate path for the same search experience
- `bingo.html` - bingo game

## Run Locally

Use any static server:

```bash
npm start
```

Then open:

```txt
http://127.0.0.1:3000/
```

VS Code Live Server also works because the search page now loads `data/headlines.json` directly.

## Update Headlines

Refresh the real-source headline dataset from GDELT:

```bash
npm run headlines:update
```

For a larger pull:

```bash
npm run headlines:update:large
```

To add from a specific year/range without rescanning everything:

```bash
node scripts/update-headlines-gdelt.mjs 2500 0 2024 2024
node scripts/update-headlines-gdelt.mjs 3000 0 2023-01-01 2023-12-31
```

Arguments are:

```txt
target-count max-days-back optional-start-date optional-end-date
```

When start/end dates are provided, `max-days-back` is ignored. The script loads the existing `data/headlines.json`, dedupes against it, and only adds new headlines until it reaches `target-count`.

The script writes to `data/headlines.json`. Commit and push that file after refreshing so deployed sites get the new data.

## Deploy

This project can deploy as a static site on GitHub Pages or Vercel. No server API or Reddit credentials are required for the search page.
