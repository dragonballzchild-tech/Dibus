# Implementation Plan: Dibus (YouTube Watcher) V1

Source spec: `SPEC.md` (in the same folder, `Read me for AI agent`; read it for requirements, design tokens and boundaries, they are not repeated here).
Tasks tracked in: `todo.md` (same folder; full acceptance criteria and verification per task).

## Overview
Dibus is a static, dark, frosted-glass YouTube watcher hosted free on Vercel. A single search bar accepts links, IDs or queries. Queries go to a small Vercel Function that calls the official YouTube Data API with a server-side key and caches results. Playing a result opens a watch view with the player and a sidebar of that search's results. History, recent chips and the last search live only in the browser.

## Architecture Decisions
- **Vanilla JS ES modules, no build step.** Smallest page weight, zero tooling to break, deploys as plain files.
- **Pure logic in small modules** (`parse.js`, `history.js`, `search.js`) so Vitest can test them without a browser. DOM wiring stays thin in `app.js`.
- **One proxy endpoint** (`GET /api/search?q=`): validates input, calls `search.list`, returns a normalized list, caches at the edge. The key never reaches client code.
- **Deploy a skeleton first.** Hosting plus a server function is the main infrastructure risk, so it is exercised in Task 2 before features pile up.
- **Vertical slices.** Each task leaves the site working: play a link, then search, then watch view, then history.
- **Search results are the sidebar data.** The watch view reuses the already fetched list, so it costs no extra quota.
- **More results without burning quota:** one request fetches 50 results (same 100 units as 12). The page reveals 12 at a time on scroll from loaded data, and an explicit `Load more` button fetches the next page (capped at 150 results per search). New task T6b.
- **Result card data:** thumbnail, title, channel, relative published date. Duration is not in `search.list`, so it is left out of V1 (can be added later with `videos.list`, about 1 quota unit per call).
- **Browser storage via one wrapper** (`storage.js`), wrapped in try/catch so private mode or blocked storage degrades gracefully instead of crashing.

## Dependency Graph
```
T1 scaffold + tokens + fonts
 ├─ T2 deploy skeleton (Vercel)
 │    └─ T4 Google API key + secret (user action)
 │         └─ T5 search proxy function ──┐
 ├─ T3 input parsing + player (?yt=)      │
 │    └──────────────┬───────────────────┘
 │                   T6 search UI (results grid)
 │                    └─ T7 watch view + sidebar
 │                         ├─ T10 recent chips + last-search persistence ─┐
 │                         └─ T12 copy link with q                        │
 ├─ T8 clear (×) + "/" shortcut (needs T6)                                │
 └─ T9 history store (pure logic) ── T11 history menu ───────────────────┘
                                                      T13 polish + a11y ── T14 README + launch
```

## Task List

### Phase 1: Foundation
- [x] T1: Scaffold, design tokens, self-hosted fonts
- [x] T2: Deploy the empty skeleton to Vercel
- [ ] T3: Paste a link or ID and play it (`?yt=` supported). Built and unit-tested; live check pending

### Checkpoint: Foundation
- [ ] `npx vitest run` passes; skeleton is live on a `*.vercel.app` URL; pasting a link plays a video there

### Phase 2: Search and watch view
- [x] T4: Create the Google API key and store it as a secret
- [x] T5: Search proxy function with caching (cache-hit header check still to confirm)
- [x] T6: Search UI: results grid
- [ ] T6b: More results: reveal 12 at a time on scroll, plus a `Load more` button (built and tested with mocks; live check pending)
- [ ] T7: Watch view with right-hand results sidebar (built and tested with mocks; live check pending)

### Checkpoint: Core flow
- [ ] Search "cars", click a result, player + sidebar appear, click another row, it swaps; works on the live URL and on a phone
- [ ] API key not visible in page source or network responses

### Phase 3: History and extras
- [ ] T8: Clear (×) button and `/` shortcut
- [ ] T9: History store (pure logic + tests)
- [ ] T10: Recent chips and last-search persistence
- [ ] T11: History menu (drawer / sheet)
- [ ] T12: Copy link with the search included

### Checkpoint: Features complete
- [ ] History, chips, sidebar persistence and shared links all work after reload and in a fresh browser profile

### Phase 4: Polish and launch
- [ ] T13: Frosted glass fallbacks, accessibility and performance pass
- [ ] T14: README, final manual checklist, production deploy

### Checkpoint: Complete
- [ ] All SPEC.md success criteria met; shared with friends

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Repeat searches may not be cached as expected by Vercel's CDN | High: quota burns faster than planned | T5 sets `Cache-Control: s-maxage` and includes a spike to confirm repeat queries are cache hits on the deployed URL; fallback is a longer `s-maxage` plus the browser-side last-search store |
| Vercel Hobby is for personal, non-commercial use and pauses the account if free limits are exceeded | Low-Med | Site is shared with friends only; about 1M function calls per month are included, and cached hits are not counted as invocations |
| Free quota is about 100 uncached searches/day | Med | Search only on submit (no autocomplete), edge cache, sidebar reuses results, clear "limit reached" message that keeps paste-and-play working. `Load more` is an explicit button (each press costs 100 units) and loading stops at 150 results per search |
| API key leaks into the repo or client code | High | Key only in Vercel environment variable; `.env.local` in `.gitignore` from T1; T5 and checkpoint verify it is absent from served files |
| Some videos block embedding | Med | T3 detects the failure and shows the "Open on YouTube" fallback |
| `backdrop-filter` is slow or unsupported on low-end phones | Low-Med | Limit glass to 3 surfaces; solid fallback via `@supports` and `prefers-reduced-transparency` (T13) |
| Google Cloud setup is unfamiliar to the user | Med | T4 is a guided walkthrough in `docs/GOOGLE_API_KEY.md`, current Console steps verified by web search at that time |
| Terms of service: embeds must stay unmodified and link to YouTube | Med | Keep the standard embed, keep Open on YouTube link, no download or ad removal (already in SPEC.md Boundaries) |
| localStorage blocked or full | Low | `storage.js` try/catch, history features degrade silently |

## Parallelization
- After T3 and T5 are done, **T8, T9 and the design-only parts of T11** can be built independently.
- T4 (user creating the key) can happen while T3 is being built.
- Everything else is sequential through the shared `app.js` wiring; avoid parallel edits to it.

## Open Questions
None blocking. Waiting for plan approval.
