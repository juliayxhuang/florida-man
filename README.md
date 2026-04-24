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

## Reddit OAuth Setup

The live search API uses Reddit OAuth when these Vercel environment variables are present:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT` (optional, but recommended)

Create the credentials:

1. Go to `https://www.reddit.com/prefs/apps`.
2. Click `create app` or `create another app`.
3. Choose `script`.
4. Add any valid URL for `redirect uri`, such as `https://florida-man-chi.vercel.app`.
5. Save the app.
6. Copy the app ID under the app name into `REDDIT_CLIENT_ID`.
7. Copy `secret` into `REDDIT_CLIENT_SECRET`.
8. Use a clear user agent, for example:

```txt
florida-man-generator/1.0 by YOUR_REDDIT_USERNAME
```

Add them in Vercel:

1. Open the Vercel project.
2. Go to `Settings` -> `Environment Variables`.
3. Add the variables above for Production.
4. Redeploy the project.

To confirm live Reddit search is being used, test:

```txt
https://florida-man-chi.vercel.app/api/reddit-search?word=meth
```

A live OAuth response includes the response header `X-Source: reddit-oauth`. If Reddit or the credentials fail, the API returns bundled fallback headlines with an `X-Fallback` header.
