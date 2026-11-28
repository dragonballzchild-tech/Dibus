# Dibus

A free-to-host, cookie-free YouTube watcher with official YouTube search. Dibus uses plain HTML, CSS, and vanilla JavaScript (ES modules), with one Vercel Function protecting the YouTube Data API key.

## Requirements

- Node.js 20 or newer (for tests and optional Vercel CLI)
- Python 3 (for local static frontend preview)
- A Google Cloud project with YouTube Data API v3 enabled and an API key
- A Vercel account and GitHub repository for deployment

## Run the frontend locally

The static preview can serve the page and assets, but `/api/search` requires the Vercel Function and will not work from Python's static server.

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. To test search locally, deploy a Vercel Preview or use `npx vercel dev` after configuring `YOUTUBE_API_KEY` in the local Vercel environment.

## Install and test

```sh
npm install
npm test
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Set Framework Preset to **Other**. Leave the build command and output directory empty; no build step is required.
4. Add `YOUTUBE_API_KEY` under **Project → Settings → Environment Variables** for Preview and Production.
5. Deploy. Future pushes to the connected branch deploy automatically.

Detailed Google API key setup: [`docs/GOOGLE_API_KEY.md`](docs/GOOGLE_API_KEY.md).

## Architecture

- `index.html`, `style.css`: accessible page shell and responsive dark UI.
- `src/app.js`: UI events, URL handling, player, history, and recent chips.
- `src/parse.js`: safe extraction of supported YouTube video IDs.
- `src/search.js`: calls the same-origin search function and normalizes results.
- `src/storage.js`: browser-only search/watch history and cached last results.
- `api/search.js`: Vercel Function endpoint.
- `lib/search-core.js`: validation, YouTube API proxy, response normalization, and CDN cache headers.
- `tests/`: Vitest unit tests.

## Notes

- Search uses YouTube Data API v3 `search.list` with `part=snippet`, `type=video`, and `maxResults=12`. Published month/year is shown; duration is not requested because the V1 API call intentionally avoids an additional `videos.list` quota cost.
- The API key is read only from the server environment. Do not commit `.env` or place the key in client-side JavaScript.
- History and recent chips are stored in this browser's `localStorage`; they are not sent to Dibus's server.
- Playback uses `youtube-nocookie.com`. Some videos cannot be embedded due to their owner's settings; use the Open on YouTube link in that case.
- The app does not scrape YouTube pages, use unofficial APIs, download/re-host videos, or add analytics/tracking.
- Inter is bundled locally. The build environment did not include Bebas Neue, so the display font is a locally bundled Noto Sans Display ExtraCondensed Bold substitute; replace `fonts/bebas-neue-substitute.woff2` with a properly licensed Bebas Neue WOFF2 if you want an exact match to the approved typeface.
- YouTube API usage remains subject to Google's quota and the [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service).
