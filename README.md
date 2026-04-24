# Florida Man

This project includes a tiny Node server (`server.js`) that serves the site **and** provides an API proxy at `/api/reddit-search` (needed because the Reddit endpoint is not reliably callable from the browser due to CORS).

## Run

1. Start the server:
   - `npm start` (or `node server.js`)
2. Open:
   - `http://localhost:3000/` or `http://localhost:3000/keyword/word.html`

## Using VS Code Live Server (optional)

If you open pages on Live Server (often `http://127.0.0.1:5500/...`), keep the Node server running too. The frontend will call `http://127.0.0.1:3000/api/reddit-search?...` for the proxy.

## Deploy With Vercel

Vercel can run the search API in `api/reddit-search.js`, so the word search page can request live Reddit results without using `localhost`.

1. Push this repo to GitHub.
2. In Vercel, create a new project from the repo.
3. Leave the default build settings blank/default. This project does not need a build command.
4. Deploy, then open:
   - `https://your-project.vercel.app/keyword/word.html`

If you host the frontend on GitHub Pages but the API on Vercel, set `VERCEL_API_ORIGIN` at the top of `keyword/wordscript.js` to your Vercel project URL, for example:

```js
const VERCEL_API_ORIGIN = "https://your-project.vercel.app";
```
