# Dibus

A free-to-host, cookie-free YouTube watcher and search tool.

## Features

- **Paste & play:** Accepts any `youtube.com/watch`, `youtu.be`, `m.youtube.com`, `/shorts/`, `/live/`, `/embed/`, or bare 11-character video ID.
- **Shareable links:** Open `/?yt=<ID>` (or `/?yt=<ID>&q=<query>`) to load the video and matching sidebar immediately.
- **Official YouTube search:** Proxied through a Vercel Function (`api/search.js`) with 1-hour CDN edge caching (`Cache-Control: s-maxage=3600`).
- **Incremental reveal & Load more:** Shows 12 results first, reveals 12 more on scroll (up to 50 per page), and lets you fetch up to 150 results via `Load more`.
- **Watch sidebar & local history:** Keeps search results in a watch-view sidebar, plus browser-only recent chips and a `History` drawer (`Watched` and `Searches` tabs).

## Setup & Local Development

1. Install dev dependencies (only needed for tests and linting; the app itself has no build step):
   ```bash
   npm install
   ```
2. Run unit tests:
   ```bash
   npx vitest run
   ```
3. Static preview (player & UI only, without `/api/search`):
   ```bash
   python3 -m http.server 8000
   ```
4. Full local testing with the Vercel Function (requires [Vercel CLI](https://vercel.com/docs/cli) and `YOUTUBE_API_KEY`):
   ```bash
   npx vercel dev
   ```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel with **Framework Preset: Other** (no build command, output directory `.`).
3. Add `YOUTUBE_API_KEY` in **Project → Settings → Environment Variables** (see `docs/GOOGLE_API_KEY.md`).
4. Deploy.

## Fonts Note

Self-hosted `.woff2` files for **Inter** (400/500) and **Inter Display** (700) are included in `fonts/`. If you want the exact condensed **Bebas Neue** display font, place `bebas-neue-400.woff2` in `fonts/` and update the `Bebas Neue` `@font-face` rule in `style.css`.
