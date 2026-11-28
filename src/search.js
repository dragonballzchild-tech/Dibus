// Browser-side search helpers. Talks to our own /api/search; never to YouTube directly.

export class SearchError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Same query written differently should hit the same cached result. */
export const normalizeQuery = (raw) => (raw ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const REVEAL_SIZE = 12; // cards shown at a time
export const MAX_LOADED = 150; // stop offering more after 3 pages of 50

const isResult = (r) => r && typeof r.id === "string" && typeof r.title === "string";

/**
 * Returns { results, nextPageToken } where results is an array of
 * { id, title, channel, thumbnail, publishedAt }, or throws SearchError(code).
 */
export async function searchVideos(query, { pageToken = null, fetchImpl = fetch } = {}) {
  let response;
  try {
    const extra = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    response = await fetchImpl(`/api/search?q=${encodeURIComponent(query)}${extra}`);
  } catch {
    throw new SearchError("network");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // handled below
  }

  if (!response.ok) {
    const known = ["quota_exceeded", "query_too_long"];
    throw new SearchError(known.includes(data?.error) ? data.error : "unavailable");
  }
  if (!Array.isArray(data?.results)) throw new SearchError("unavailable");
  const nextPageToken = typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : null;
  return { results: data.results.filter(isResult), nextPageToken };
}

/** How many cards to show after revealing another batch. */
export const nextBatch = (shown, total, size = REVEAL_SIZE) => Math.min(total, shown + size);

/** Appends new results to the existing list, skipping any video we already have. */
export function mergeResults(existing, incoming) {
  const seen = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/** The Load more button is offered only while YouTube has more and we are under the cap. */
export const canLoadMore = (loaded, nextPageToken, max = MAX_LOADED) => Boolean(nextPageToken) && loaded < max;

/** Text shown under the grid once everything loaded is visible and no button is offered. */
export function endMessage(loaded, nextPageToken, max = MAX_LOADED) {
  if (!nextPageToken) return "End of results";
  if (loaded >= max) return "That’s all for now. Try a more specific search.";
  return "";
}

export function errorMessage(code) {
  switch (code) {
    case "quota_exceeded":
      return "Search limit reached for today. Paste a YouTube link instead.";
    case "query_too_long":
      return "That search is too long. Try fewer words.";
    case "network":
      return "Can’t reach Dibus. Check your connection and try again.";
    default:
      return "Search isn’t working right now. Try again later, or paste a YouTube link.";
  }
}

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "yesterday", "just now". Returns "" for missing or invalid dates. */
export function formatRelativeDate(iso, now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}
