# Spec: Dibus (YouTube Watcher) — V1

## Objective

A free-to-host, cookie-free YouTube watcher, modeled on https://michael.team/yt/, plus a search bar backed by YouTube's own search so results are accurate.

**User:** one person (and friends they share the link with) who wants to watch YouTube videos without pop-ups, tracking, or a recommendations sidebar.

**User stories**
1. I paste a YouTube link or video ID and the video plays in an embedded player.
2. I open `/?yt=<link or ID>` and the video plays immediately (shareable links).
3. I type a query in the search bar and see accurate YouTube results (thumbnail, title, channel, published date). Duration is not part of the search response, so it is left out of V1.
4. I can see more results: the page shows 12 at a time as I scroll, and a Load more button fetches the next page from YouTube.
5. I click a result and it plays on the same page. The player takes the main area and the results of my search stay in a sidebar on the right (like YouTube's watch page), so I can keep clicking through videos from the same search without searching again. The Back button steps through the videos I picked, in order, and then returns to the search results.
6. I can clear the search bar with an (×) button, press `/` to focus it, and see chips for my recent searches and recently watched videos (stored only in my browser).
7. I can open a History menu to see everything I've searched and watched, jump back to any item, remove single items, or clear it all.
8. If a video cannot be embedded, I see a clear message and an "Open on YouTube" link.
9. It works well on phones, tablets, and desktop, with fullscreen and picture-in-picture.

## Tech Stack

- Frontend: plain HTML, CSS, and vanilla JavaScript (ES modules). No framework, no build step.
- Fonts: Bebas Neue (display) and Inter (body), self-hosted as woff2 to keep the site tracker-free.
- Playback: `https://www.youtube-nocookie.com/embed/<ID>` iframe.
- Search: YouTube Data API v3, `search.list` endpoint (`part=snippet`, `type=video`, `maxResults=50`, optional `pageToken` for the next page). One request costs 100 quota units whatever the page size, so fetching 50 costs the same as fetching 12.
- Search proxy: a Vercel Function (`api/search.js`, standard fetch handler, shared logic in `lib/`), so the API key stays server-side. Edge caching through `Cache-Control: s-maxage` on the response (Vercel's CDN).
- Hosting: Vercel Hobby plan (free, personal use). One GitHub repo, one deploy, frontend and function together. No build step (Framework Preset: Other).
- Tests: Vitest for unit tests (pure functions).

## Commands

```
Dev (static pages only):   python3 -m http.server 8000
Function testing:          on the deployed Vercel preview URL (or `npx vercel dev` if the CLI is installed)
Unit tests:                npx vitest run
Lint:                      npx eslint . --fix
Deploy:                    push to GitHub (Vercel deploys automatically)
Set API key secret:        Vercel dashboard → Project → Settings → Environment Variables → YOUTUBE_API_KEY
```

## Project Structure

```
index.html              → Page shell: search bar, watch view (player + sidebar), results grid
style.css               → Styles (mobile-first, dark theme only, design tokens as CSS variables)
fonts/                  → Self-hosted woff2 font files (no third-party font requests)
src/app.js              → Wires up UI events, view switching, URL param handling
src/parse.js            → parseVideoId(input) and classifyInput(input)
src/player.js           → Embed URL and player-error helpers
src/search.js           → Calls /api/search, normalizes results, reveal and merge helpers
src/view.js             → Watch view helpers (sidebar heading)
api/search.js           → Vercel Function: proxies + caches YouTube API calls (thin handler)
lib/search-core.js      → Search logic used by api/search.js (outside api/, because every file in api/ becomes its own function)
tests/                  → Vitest unit tests
docs/GOOGLE_API_KEY.md  → Guide to creating the YouTube API key
Read me for AI agent/   → SPEC.md (this document), plan.md, todo.md
README.md               → Setup and deploy instructions (T14)
```

## Code Style

Small pure functions, named exports, `const` by default, no semicolon-free tricks, 2-space indent, early returns.

```js
// src/parse.js
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoId(input) {
  const text = (input ?? "").trim();
  if (ID_RE.test(text)) return text;

  let url;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return pick(url.pathname.slice(1));
  if (host === "youtube.com") {
    if (url.pathname === "/watch") return pick(url.searchParams.get("v"));
    const m = url.pathname.match(/^\/(shorts|live|embed)\/([^/?]+)/);
    if (m) return pick(m[2]);
  }
  return null;
}

const pick = (id) => (ID_RE.test(id ?? "") ? id : null);
```

Conventions: files are kebab-case or lowercase, functions camelCase, no global state outside `app.js`, never use `innerHTML` with API data (use `textContent` / DOM creation to avoid XSS).

## Design

**Reference:** the user's screenshot (Delta Cafés "The Coffee Cycle" page, `IMG_8041.png`). Match its font style and colors. The layout is intentionally different: a tool, not a long scrolling marketing page.

**Mood:** warm, dark, cinematic, calm. Espresso-black surfaces, cream type, generous spacing, very little chrome.

**Color tokens** (sampled from the screenshot unless noted)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#100b07` | Page background |
| `--bg-deep` | `#0a0605` | Footer, deepest areas |
| `--surface` | `#140a08` | Gaps between cards, input wells |
| `--cream` | `#edd1bc` | Headings and primary text |
| `--pill` | `#fbdfd3` | Primary buttons (cream pill) |
| `--pill-dark` | `#36241a` | Arrow circle on buttons, secondary buttons |
| `--cream-muted` | `rgba(237, 209, 188, 0.7)` | Body and secondary text (derived) |
| `--accent` | `#9d6840` | Warm brown highlight, focus ring tint (sampled from the photo area) |

The tiny lime-green line in the reference is a decorative accent; use sparingly (e.g. active/now-playing indicator). Approximate value `#9be15d`, not sampled.

**Typography**
- Display: condensed, bold, uppercase, tight leading. Closest free match: **Bebas Neue**. Used for the wordmark `DIBUS`, section titles (`NOW PLAYING`, `RESULTS`) and result titles on hover or in the featured card.
- Body/UI: clean neutral sans, small and light. **Inter** (400/500), 14–16 px.
- Small uppercase labels with wide letter-spacing (like "CHAPTER I") for section tags.

**Components**
- **Pill button:** cream pill (`--pill`, dark text) with a small dark circular arrow button attached, as in the "Discover →" buttons.
- **Cards:** large rounded corners (about 24 px), dark surface, thumbnail fills the top, title in cream below.
- **Thin line icons:** 1.5 px stroke, cream, for PiP, fullscreen, copy link, open on YouTube.
- **Frosted glass** (where it fits, kept to 3 places): the sticky top bar, the search input, and the control strip under the player.
  - `background: rgba(237, 209, 188, 0.07)`, `backdrop-filter: blur(16px) saturate(140%)`, `border: 1px solid rgba(237, 209, 188, 0.14)`.
  - Fallback to a solid `--surface` when `backdrop-filter` is unsupported or the user prefers reduced transparency.
  - Text on glass must keep a contrast ratio of at least 4.5:1.
- **Motion:** subtle fade/translate on result load and card hover; disabled under `prefers-reduced-motion`.

**Layout (mobile-first)**
1. Sticky frosted top bar: `DIBUS` wordmark left, `History` button right (the single search bar already accepts links, so no separate paste control).
2. Hero: one large frosted search bar (accepts a search query or a YouTube link/ID), pill "Search" button.
3. **Search view** (no video selected): hero search bar, chips for recent searches and recently watched videos, then the `RESULTS` grid (1 column on phones, 2 on tablets, 3 to 4 on desktop). The grid shows 12 cards first and reveals 12 more each time the bottom comes into view; once everything loaded is visible and YouTube has more, a `Load more` pill button fetches the next page (up to 150 results per search in total). Clicking a card switches to the watch view; the grid is hidden while a video plays and comes back, at the same scroll position, when the person goes Back.
4. **Watch view** (video selected):
   - Desktop (≥ 1024 px): two columns. Left: 16:9 rounded player and the frosted control strip (Open on YouTube, Copy link). Right: a sidebar titled with the search query (e.g. `RESULTS FOR "CARS"`) listing every result loaded so far (not only the 12 shown in the grid) as compact rows (small thumbnail, title, channel). The sidebar stays in view while the page scrolls and its list scrolls on its own. The playing video is highlighted with the lime accent line. Clicking a row swaps the video without losing the list or its scroll position. The page is wider in this view (up to 1320 px) so the player is not cramped.
   - Mobile/tablet: player on top, the same list stacked below it. Picking a row scrolls the page back up to the player.
   - The sidebar reuses the results already fetched, so it costs no extra API quota.
   - A search made while watching refills the sidebar; the video keeps playing.
   - If there is no previous search (e.g. someone opens a plain `?yt=ID` link), the sidebar shows an empty state: "Search to fill this list".
   - Every video picked (from the grid, a sidebar row or a pasted link) adds a browser-history entry: Back goes to the previous video, and Back again returns to the search view.
5. Footer: minimal, deep background, "Dibus. Not affiliated with YouTube." plus the link to YouTube's terms.

**Extras included in V1**
- **Clear (×) button** inside the search bar (visible when it has text).
- **`/` shortcut** focuses the search bar (ignored while typing in an input).
- **Recent chips:** the last 8 searches and last 8 watched videos, stored in `localStorage` in the browser only, with a "Clear" action. Never sent to any server.
- **History menu:** the `History` button in the top bar opens a frosted glass panel (a right-side drawer on desktop, full-screen sheet on phones) with two tabs, `Watched` and `Searches`.
  - Each item shows its title/query and a relative time ("Today", "Yesterday", date). Clicking a watched item plays it; clicking a search re-runs it (served from the edge cache when recent).
  - Per-item remove (×) and a `Clear all` pill button with a confirmation step.
  - Stored in `localStorage` only, capped at 200 entries per tab (oldest dropped). Nothing leaves the browser.
  - Duplicates collapse: re-watching or re-searching moves the item to the top instead of adding a new entry.
- **Copy link** copies `?yt=ID&q=<last query>` so a friend sees the same sidebar. The page re-runs that search through the cached proxy.
- **Last search persistence:** the most recent results are saved in `localStorage` so the watch-view sidebar survives a page reload.

**Empty / error states:** styled in the same cream-on-dark language (e.g. "Nothing found", "Search limit reached for today, paste a link instead", "This video can't be embedded" with an Open on YouTube pill).

## Testing Strategy

- **Unit (Vitest):** `parseVideoId` covers watch, youtu.be, m.youtube, Shorts, Live, embed, bare ID, invalid input, URLs with extra params (`&t=30s`, `?si=`). Search result normalization covers missing fields. Reveal-in-batches, merge-without-duplicates and page-token handling are covered. Watch view helpers are covered.
- **Function test:** `lib/search-core.js` (and the thin `api/search.js` handler) tested with a mocked `fetch` (success, quota-exceeded 403, empty query, upstream error, page token).
- **Page behavior:** checked in a headless browser with mocked search responses (view switching, sidebar, Back and Forward, layouts); these checks are run by hand and are not part of `npx vitest run`.
- **Manual checklist before deploy:** paste a link, use `?yt=`, search, play a result, test a non-embeddable video, test on a phone, test fullscreen and PiP.
- No coverage threshold; the parser and proxy must have tests.

## Boundaries

- **Always:** validate and sanitize all input (query length ≤ 100 chars, video IDs match `^[A-Za-z0-9_-]{11}$`, page tokens only letters, digits, `-` and `_` up to 100 characters); render API data with `textContent`; use `youtube-nocookie.com`; keep the API key only in Vercel environment variables; run unit tests before deploy.
- **Ask first:** adding any dependency or framework; adding a database or accounts; changing the hosting provider; anything that would increase API quota use (e.g. search-as-you-type, fetching further pages automatically).
- **Never:** commit the API key or put it in client code; scrape YouTube HTML or use unofficial endpoints; add analytics or trackers; download or re-host video content; strip or hide YouTube branding/links in a way that violates YouTube's API Terms of Service.

## Success Criteria

- Pasting any of: `youtube.com/watch?v=ID`, `m.youtube.com/...`, `youtu.be/ID`, `/shorts/ID`, `/live/ID`, or a bare ID loads the correct video.
- `/?yt=<link or ID>` autoplays-ready the correct video on load (browser autoplay rules permitting).
- A search returns up to 50 results in under 1.5 s (p50) on a normal connection; the same query repeated within an hour is served from cache.
- The grid shows 12 results first and reveals 12 more each time the bottom comes into view, with no network request. A `Load more` button appears once everything loaded is visible and YouTube has a next page; pressing it fetches that page (one more search, 100 quota units), appends the results without duplicates, and stops at 150 results per search. Nothing fetches further pages automatically.
- Results match what the YouTube Data API returns for that query (no re-ranking, no filtering beyond `type=video`).
- Clicking a result plays it and updates the URL to `?yt=ID` without a full page reload.
- After a search, clicking a result opens the watch view with the player and a right sidebar listing that search's results, with no additional API call; clicking another sidebar row plays it and keeps the list and its scroll position.
- Back goes to the previous video; Back again returns to the search results with the grid at the same scroll position.
- Recent search and watched chips persist across reloads, can be cleared, and nothing about them leaves the browser.
- `/` focuses the search bar; (×) clears it.
- The History menu lists watched videos and searches (newest first), supports removing one item and clearing everything, and the cleared state persists after a reload.
- A copied link opens to the same video and, via `q`, the same sidebar results for a friend with empty storage.
- API key is not present in any file served to the browser (verified by viewing page source and network responses).
- Non-embeddable or failed videos show an error message and an "Open on YouTube" link.
- If the API quota is exhausted, the user sees a clear "Search limit reached for today, paste a link instead" message; paste-and-play still works.
- Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 90.
- Visual design matches the Design section below (tokens, fonts, pill buttons, frosted glass) and is checked against the reference screenshot (IMG_8041.png).
- Total page weight before the first video load < 150 KB including fonts (no frameworks).
- Entire stack runs on free tiers with no credit card required for Vercel Hobby (a Google Cloud account is needed for the API key).

## Out of Scope (Deferred)

- Syncing or exporting history across devices: needs a server or an account.
- Search-as-you-type suggestions: would burn the daily API quota quickly.
- Fetching further pages automatically (endless scroll that calls the API): each page costs 100 quota units. Only the explicit `Load more` button fetches more.
- Video duration on cards: not in `search.list`; would need `videos.list` (about 1 quota unit per call).
- Channel pages, playlists, comments, related videos: not part of the minimal, distraction-free goal.
- Accounts, favorites, cross-device history: needs a server and increases scope. (Browser-only recent chips are in V1.)
- Short domain / redirect (like xoutu.be): requires buying a domain.
- iOS Shortcut / share-sheet integration: nice to have after the site exists.
- Ad blocking or ad skipping: not guaranteed, and not a goal of V1.
- Fallback to Invidious/Piped when quota is exhausted: unreliable instances; revisit if quota becomes a real problem.

## Decisions Log

- Quota of about 100 uncached searches per day is enough (user).
- Search: official YouTube Data API v3 through a Vercel Function; hosting on Vercel Hobby (switched from Cloudflare Pages because the user cannot use Cloudflare).
- Name: Dibus. UI: English only.
- Audience: user and friends only; no rate limiter in V1.
- Google Cloud project and API key: user needs a step-by-step guide (to be written as `docs/GOOGLE_API_KEY.md` in T4).
- Fonts: Bebas Neue (display) + Inter (body) approved as close enough to the reference.
- One search bar handles both pasted links/IDs and normal queries (links and IDs are detected first; anything else is a search).
- Branding: text-only `DIBUS` wordmark, no logo mark.
- Extras in V1: clear (×) button, `/` shortcut, recent searches/watched chips (browser-only). Not selected: start-time support, copy/share beyond the basic Copy link, autoplay toggle, About popup.
- Watch view: player plus right sidebar showing the results of the last search (stacked below the player on mobile).
- Copy link includes the search (`?yt=ID&q=...`) so friends see the same sidebar (user: "whatever is easier"; my default adopted).
- History menu added: full list of watched videos and searches, per-item remove and clear all, stored only in the browser.
- Vercel Hobby is free but for personal, non-commercial use and pauses the account if free limits are exceeded; fine for a site shared with friends.
- Shared code for functions lives in `lib/`, not `api/` (every file in `api/` becomes its own Vercel function).
- More results (user chose the "middle option"): one request fetches 50 results; the page shows 12 at a time as the person scrolls, from data already loaded; an explicit `Load more` button fetches the next page; capped at 150 results per search. This replaces the earlier decision to keep 12 results and no "See more".
- One search costs 100 quota units whatever the page size, so the first page of 50 costs the same as 12; each `Load more` press costs another 100.
- Watch view (built in T7): the results grid is hidden while a video plays; the sidebar lists every loaded result and grows when `Load more` is pressed; a search made while watching refills the sidebar and the video keeps playing; the page widens to 1320 px in the watch view.
- Back button (user): every video picked, whether from the grid, a sidebar row or a pasted link, adds a history entry, so Back steps through the videos in order and then returns to the search results. (An earlier build replaced the entry on sidebar picks; the user asked for this instead.)
- SPEC.md, plan.md and todo.md live together in the repo folder `Read me for AI agent` (user).

## Open Questions

None.
