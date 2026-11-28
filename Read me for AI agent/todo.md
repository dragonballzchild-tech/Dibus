# Dibus V1: Task List

Spec: `SPEC.md` | Plan: `plan.md` (the spec, plan and this task list all live in the `Read me for AI agent` folder)
Commands: tests `npx vitest run`, local static preview `python3 -m http.server 8000`, lint `npx eslint .`, deploy by pushing to GitHub (Vercel deploys automatically). The server function is tested on the deployed Vercel URL.
No build step exists, so "Build succeeds" means the page loads without console errors.

## Status (updated)
- T1 done. T2 done on **Vercel** (Cloudflare was not usable); the user confirmed the live site works.
- T3 built and unit-tested; real YouTube playback and the embed-error message still need a manual check on the live site.
- T4 done: the user created the key and added it to Vercel; `/api/search?q=cars` returns real results live.
- T5 done (code, tests, live results). Cache-hit header (`x-vercel-cache: HIT`) not yet confirmed by the user.
- T6 done: the user confirmed on the live site that cards appear and link/search both work.
- T6b built: the server fetches 50 results per request with `pageToken`/`nextPageToken`; the page reveals 12 at a time on scroll and offers `Load more` (cap 150). Verified in a headless browser with mocked pages (reveal, Load more, cap, errors, dedupe, stale results, no-IntersectionObserver fallback, tall screens); live check by the user pending.
- T7 built: watch view with the player on the left and a results sidebar on the right (stacked below the player under 1024 px). Verified with `tests/view.test.js` and a headless browser run using mocked search results (view switching, no extra API call, sidebar row swap keeps the list scroll and replaces the history entry, Back restores the grid and its scroll position, layout at 1024/1023 px and on a phone, empty state for plain links, Load more feeding the sidebar). Live check by the user pending.
- Next: the user checks T6b and T7 live (and the `x-vercel-cache` header from T5); then T8 (clear (×) button and `/` shortcut).

---

## Phase 1: Foundation

## Task 1: Scaffold, design tokens, self-hosted fonts
**Description:** Create the repo structure, the dark theme CSS variables from the spec, and self-hosted Bebas Neue and Inter (woff2). Page shows the `DIBUS` wordmark in the frosted top bar on the espresso background.
**Acceptance criteria:**
- [x] `index.html`, `style.css`, `src/app.js`, `fonts/`, `package.json` (vitest, eslint), `.gitignore` (includes `.env.local`, `node_modules`) exist
- [x] All color tokens from SPEC.md are CSS variables; no third-party font or script requests in the Network tab
- [x] Top bar uses the frosted glass recipe with a solid fallback
**Verification:**
- [x] `npx vitest run` runs (even with 0 tests) and `npx eslint .` is clean
- [x] Manual: page loads on desktop and a 375 px viewport, fonts render correctly
**Dependencies:** None
**Files likely touched:** `index.html`, `style.css`, `src/app.js`, `package.json`, `.gitignore`
**Estimated scope:** Medium

## Task 2: Deploy the empty skeleton to Vercel
**Description:** Connect the GitHub repo to Vercel (Framework Preset: Other, no build command) and publish the skeleton, so hosting and server functions are proven before features are built. Originally planned for Cloudflare Pages; moved to Vercel because the user cannot use Cloudflare.
**Acceptance criteria:**
- [x] Site is reachable on a `*.vercel.app` URL showing the Dibus skeleton
- [x] A trivial `api/ping.js` returns `ok` on the deployed URL (removed in T5)
**Verification:**
- [x] Manual: open the live URL on a phone; `/api/ping` returns `ok`
**Dependencies:** Task 1
**Files likely touched:** `api/ping.js`, `.vercelignore`, `package.json`
**Estimated scope:** Small

## Task 3: Paste a link or ID and play it (`?yt=` supported)
**Description:** Implement `parseVideoId` and `classifyInput` (video vs search query), the nocookie player in the rounded 16:9 container, URL updating with `pushState`, loading from `?yt=` on page load, and the embed-error fallback with an "Open on YouTube" pill button.
**Acceptance criteria:**
- [x] watch, `m.youtube`, `youtu.be`, Shorts, Live, embed links, and bare 11-char IDs all resolve to the right ID; invalid input returns null
- [x] `/?yt=<link or ID>` loads the video on page load; pasting in the bar plays it and updates the URL without reload
- [ ] A video that can't be embedded shows the error message and the Open on YouTube link
**Verification:**
- [x] `npx vitest run` passes (parser cases incl. extra params like `&t=30s`, `?si=`, trailing slashes, uppercase host)
- [ ] Manual: test each link type, a bad link, and a known non-embeddable video
**Dependencies:** Task 1
**Files likely touched:** `src/parse.js`, `tests/parse.test.js`, `src/app.js`, `index.html`, `style.css`
**Estimated scope:** Medium

### Checkpoint: Foundation
- [ ] Tests pass, lint clean, live URL plays a pasted link
- [ ] Review with human before proceeding

---

## Phase 2: Search and watch view

## Task 4: Create the Google API key and store it as a secret (guided)
**Description:** Write `docs/GOOGLE_API_KEY.md` and walk the user through it: create a Google Cloud project, enable YouTube Data API v3, create an API key, restrict it to that API, then store it in Vercel (Project Settings → Environment Variables → `YOUTUBE_API_KEY`). Current Console steps are checked via web search when this task starts.
**Acceptance criteria:**
- [x] Key restricted to YouTube Data API v3 only
- [x] Secret set on the Vercel project as an environment variable; no key file is committed (`.env*` is git-ignored)
- [x] The key is never pasted into chat, code, or committed files
**Verification:**
- [x] Manual: `git status` shows no key; a test `curl` through the function (after T5) returns results
**Dependencies:** Task 2
**Files likely touched:** `docs/GOOGLE_API_KEY.md`
**Estimated scope:** Small (mostly user actions)

## Task 5: Search proxy function with caching
**Description:** Implement `GET /api/search?q=` as a Vercel Function: validate the query (non-empty, max 100 chars), call `search.list` (`type=video`, `maxResults=12`), normalize to `{id, title, channel, thumbnail, publishedAt}`, set `Cache-Control: s-maxage` headers, and map errors (quota exceeded, upstream failure) to clear JSON errors. Search logic lives in `lib/search-core.js` (outside `api/`, because every file in `api/` becomes its own function) and `api/search.js` is a thin handler. Includes a spike to confirm Vercel's CDN caches repeat queries on the deployed URL.
**Acceptance criteria:**
- [x] Valid query returns up to 12 normalized results; empty or too-long query returns 400
- [x] Quota-exceeded upstream response returns a distinct error code the UI can recognize
- [ ] Repeat of the same query within an hour is served from cache (verified on the deployed URL), or the fallback from the plan is applied (pending: user to check `x-vercel-cache`)
- [x] Response and source contain no API key
**Verification:**
- [x] `npx vitest run` passes (mocked fetch: success, 403 quota, 500, bad input, missing fields)
- [x] `ping.js` removed; live endpoint returns real results (user confirmed)
- [ ] Manual: call the live endpoint twice and confirm the second is a cache hit
**Dependencies:** Tasks 2, 4
**Files likely touched:** `api/search.js`, `lib/search-core.js`, `tests/search-core.test.js`, `api/ping.js` (delete)
**Estimated scope:** Medium

## Task 6: Search UI: results grid
**Description:** Make the single search bar route input through `classifyInput`: links and IDs play, anything else searches. Show the `RESULTS` grid (1 to 4 columns) with loading, empty and error states, including the "Search limit reached for today, paste a link instead" message. Clicking a card plays it.
**Acceptance criteria:**
- [x] Typing a query and pressing Enter shows up to 12 cards; clicking one plays it
- [x] Pasting a link in the same bar plays it instead of searching
- [x] Loading, "Nothing found", network error and quota messages are styled per the spec
- [x] All API text is rendered with `textContent` (no `innerHTML`)
**Verification:**
- [x] `npx vitest run` passes (`search.js` client normalization and error mapping)
- [x] Manual: search on desktop, tap a card, link and search both work (user confirmed live)
**Dependencies:** Tasks 3, 5
**Files likely touched:** `src/search.js`, `tests/search.test.js`, `src/app.js`, `index.html`, `style.css`
**Estimated scope:** Medium

## Task 6b: More results: reveal on scroll and Load more
**Description:** Change the server to fetch 50 results per search and accept an optional `pageToken`, returning `nextPageToken` when YouTube has more. On the page, show the first 12 cards, reveal the next 12 from loaded data as the user scrolls near the bottom, and show a `Load more` button once everything loaded is visible and a next page exists. Cap at 150 results per search.
**Acceptance criteria:**
- [x] `/api/search` requests `maxResults=50`, accepts an optional `pageToken` (validated: letters, digits, `-` and `_`, up to 100 characters), and returns `nextPageToken` (or `null`); a bad token returns 400; the key still never appears in responses
- [x] The grid shows 12 cards first; scrolling near the bottom reveals 12 more with no network request; browsers without `IntersectionObserver` show all loaded results at once
- [x] `Load more` appears only when all loaded results are visible and a next page exists and fewer than 150 are loaded; pressing it fetches the next page, appends results without duplicates, and reveals 12 at a time
- [x] A failed `Load more` shows a message next to the button, keeps existing results, and can be retried
- [x] The end of results shows "End of results" (no more pages) or "That's all for now. Try a more specific search." (cap reached)
- [x] A new search replaces the previous list and resets the reveal count and page token
**Verification:**
- [x] `npx vitest run` passes (pageToken validation, `nextPageToken` pass-through, reveal-in-batches helper, merge-without-duplicates helper, client passes `pageToken`)
- [ ] Manual: search a broad term, scroll to reveal batches, press `Load more` once, confirm the quota use is 200 units for that search in the Google Cloud quota page
**Dependencies:** Task 6
**Files likely touched:** `lib/search-core.js`, `api/search.js`, `src/search.js`, `src/app.js`, `style.css`, `tests/search-core.test.js`, `tests/search-handler.test.js`, `tests/search.test.js`
**Estimated scope:** Medium

## Task 7: Watch view with right-hand results sidebar
**Description:** When a result is clicked, switch to the watch view: player and frosted control strip on the left, scrollable sidebar `RESULTS FOR "<query>"` on the right (stacked below on screens under 1024 px) listing the same results as compact rows. The playing row gets the lime accent line. Clicking a row swaps the video, keeps the list and scroll position, and updates the URL. Plain `?yt=ID` with no prior search shows "Search to fill this list".
**Acceptance criteria:**
- [x] Sidebar uses the already fetched results (no extra network call; checked by counting requests in a headless run, still to confirm in the Network tab live)
- [x] Clicking a sidebar row changes the video without losing the list or scroll position
- [x] Layout switches correctly at the 1024 px breakpoint; empty-sidebar state shows for plain links
**Verification:**
- [x] `npx vitest run` passes (`tests/view.test.js`: sidebar heading text and history mode)
- [ ] Manual: desktop two-column, phone stacked, rapid row clicking, browser back button returns to the search view
**Dependencies:** Task 6b
**Files likely touched:** `src/app.js`, `src/view.js`, `tests/view.test.js`, `index.html`, `style.css`
**Estimated scope:** Medium
**Decisions made while building (to fold into the SPEC.md decisions log):**
- The grid is hidden while a video plays; Back returns to the grid at the same scroll position.
- The sidebar lists every loaded result (it grows when `Load more` is pressed in the grid), not only the 12 shown.
- Picking a video from the sidebar replaces the current browser-history entry, so Back goes to the search view instead of stepping through every video. Opening a video from the grid or pasting a link still adds an entry.
- A search made while watching refills the sidebar and the video keeps playing.
- The page is wider in the watch view (up to 1320 px) so the player is not cramped next to the sidebar.

### Checkpoint: Core flow
- [ ] Search, click, watch with sidebar works on the live URL and on a phone
- [ ] View-source and Network responses contain no API key
- [ ] Review with human before proceeding

---

## Phase 3: History and extras

## Task 8: Clear (×) button and `/` shortcut
**Description:** Add the (×) button to the search bar (visible only when it has text) and a global `/` key that focuses the bar unless the user is already typing in an input.
**Acceptance criteria:**
- [ ] (×) clears the text and refocuses the input
- [ ] `/` focuses the bar and does not insert a "/" character; ignored inside inputs
**Verification:**
- [ ] Manual: both behaviors on desktop; (×) on a phone
**Dependencies:** Task 6
**Files likely touched:** `src/app.js`, `index.html`, `style.css`
**Estimated scope:** Small

## Task 9: History store (pure logic + tests)
**Description:** Create `storage.js` (safe localStorage wrapper) and `history.js` with `addWatched`, `addSearch`, `list`, `remove`, `clear`. Newest first, duplicates move to the top, capped at 200 per type, survives corrupted or missing storage.
**Acceptance criteria:**
- [ ] Add, dedupe, cap at 200, remove one, clear all behave as specified
- [ ] Corrupt JSON or throwing storage does not crash; functions return empty lists
**Verification:**
- [ ] `npx vitest run` passes (including simulated storage failure and cap overflow)
**Dependencies:** Task 1
**Files likely touched:** `src/storage.js`, `src/history.js`, `tests/history.test.js`
**Estimated scope:** Small

## Task 10: Recent chips and last-search persistence
**Description:** Record every watched video and search via the history store. Show the last 8 searches and last 8 watched videos as chips on the search view. Save the latest results and query so the watch-view sidebar survives a reload.
**Acceptance criteria:**
- [ ] Chips appear after use, persist across reloads, and clicking one runs or plays it
- [ ] Reloading the watch view still shows the sidebar from the last search
**Verification:**
- [ ] Manual: search, watch, reload, close and reopen the tab; confirm chips and sidebar remain
**Dependencies:** Tasks 7, 9
**Files likely touched:** `src/app.js`, `src/history.js`, `index.html`, `style.css`
**Estimated scope:** Small

## Task 11: History menu (drawer / sheet)
**Description:** Add the `History` button in the top bar. It opens a frosted panel (right drawer on desktop, full-screen sheet on phones) with `Watched` and `Searches` tabs, relative times, per-item remove (×) and a `Clear all` pill button with a confirmation step.
**Acceptance criteria:**
- [ ] Both tabs list items newest first; clicking an item plays or re-runs it and closes the panel
- [ ] Remove one and Clear all (with confirm) work and persist after reload
- [ ] Panel is keyboard accessible: focus trap, Esc closes, focus returns to the button
**Verification:**
- [ ] Manual: desktop and phone, keyboard-only pass, clear then reload
**Dependencies:** Tasks 9, 10
**Files likely touched:** `src/history-menu.js`, `src/app.js`, `index.html`, `style.css`
**Estimated scope:** Medium

## Task 12: Copy link with the search included
**Description:** The Copy link button in the control strip copies `?yt=ID&q=<last query>`. On load, if `q` is present, run that search through the cached proxy to fill the sidebar.
**Acceptance criteria:**
- [ ] Copied link includes `q` when a search exists, and only `yt` otherwise
- [ ] Opening the link in a fresh browser profile shows the video and the matching sidebar
- [ ] `q` is validated (max 100 chars) before use
**Verification:**
- [ ] `npx vitest run` passes (link build and parse helpers)
- [ ] Manual: open a copied link in a private window
**Dependencies:** Task 7
**Files likely touched:** `src/share.js`, `tests/share.test.js`, `src/app.js`
**Estimated scope:** Small

### Checkpoint: Features complete
- [ ] History, chips, sidebar persistence and shared links work after reload and in a fresh profile
- [ ] Review with human before proceeding

---

## Phase 4: Polish and launch

## Task 13: Frosted glass fallbacks, accessibility and performance pass
**Description:** Add `@supports` and `prefers-reduced-transparency` fallbacks, `prefers-reduced-motion` handling, visible focus rings, ARIA labels on icon buttons, and verify contrast on glass surfaces. Run Lighthouse on mobile.
**Acceptance criteria:**
- [ ] Lighthouse mobile Performance and Accessibility are 90 or higher
- [ ] Text on glass meets 4.5:1 contrast; every control reachable and operable by keyboard
- [ ] Page weight before the first video is under 150 KB including fonts
**Verification:**
- [ ] Lighthouse report saved; manual keyboard and screen-reader spot check
**Dependencies:** Tasks 8, 11, 12
**Files likely touched:** `style.css`, `index.html`, `src/app.js`
**Estimated scope:** Medium

## Task 14: README, final manual checklist, production deploy
**Description:** Write `README.md` (setup, local dev, deploy, key rotation, privacy notes: history stays in the browser, queries pass through the proxy to YouTube's API, embeds still contact YouTube), run the manual checklist from SPEC.md, and deploy.
**Acceptance criteria:**
- [ ] A new person can set up and deploy from the README alone
- [ ] Every item in SPEC.md Success Criteria is checked off
**Verification:**
- [ ] Full manual checklist on desktop and phone against the production URL
**Dependencies:** Task 13
**Files likely touched:** `README.md`
**Estimated scope:** Small

### Checkpoint: Complete
- [ ] All acceptance criteria met; link ready to share with friends
