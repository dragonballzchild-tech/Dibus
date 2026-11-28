// Search logic for the /api/search function. Pure except for the injected fetch.
// Lives in lib/ (not api/) because every file in api/ becomes its own Vercel function.

export const MAX_QUERY_LENGTH = 100;
export const MAX_RESULTS = 50;
const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{1,100}$/;
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const QUOTA_REASONS = ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"];

// Successful searches are cached at the edge for an hour; errors are never cached.
export const CACHE_OK = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
export const CACHE_NONE = "no-store";

/** Trims, collapses whitespace, and rejects empty or too-long queries. */
export function validateQuery(raw) {
  const query = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!query) return { ok: false, error: "missing_query" };
  if (query.length > MAX_QUERY_LENGTH) return { ok: false, error: "query_too_long" };
  return { ok: true, query };
}

/** The page token is optional (it asks for the next page of a search). Anything odd is rejected. */
export function validatePageToken(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, token: null };
  if (typeof raw === "string" && PAGE_TOKEN_RE.test(raw)) return { ok: true, token: raw };
  return { ok: false, error: "bad_page_token" };
}

export function buildSearchUrl(query, pageToken = null) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(MAX_RESULTS),
    q: query,
  });
  if (pageToken) params.set("pageToken", pageToken);
  return `${SEARCH_URL}?${params}`;
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** YouTube returns titles with HTML entities (&#39;, &amp;). We render with textContent, so decode them. */
export function decodeEntities(text) {
  return String(text ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Turns YouTube's search response into the small list the page needs. */
export function normalizeItems(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  return items
    .map((item) => {
      const snippet = item?.snippet ?? {};
      const thumbs = snippet.thumbnails ?? {};
      return {
        id: item?.id?.videoId ?? "",
        title: decodeEntities(snippet.title).trim(),
        channel: decodeEntities(snippet.channelTitle).trim(),
        thumbnail: (thumbs.medium ?? thumbs.high ?? thumbs.default)?.url ?? "",
        publishedAt: snippet.publishedAt ?? "",
      };
    })
    .filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id));
}

const fail = (status, error) => ({ status, body: { error }, cache: CACHE_NONE });

/**
 * Runs one search. Returns { status, body, cache } and never throws.
 * Upstream error details are not passed to the browser.
 */
export async function handleSearch({ query: rawQuery, pageToken: rawToken, apiKey, fetchImpl = fetch }) {
  const checked = validateQuery(rawQuery);
  if (!checked.ok) return fail(400, checked.error);
  const page = validatePageToken(rawToken);
  if (!page.ok) return fail(400, page.error);
  if (!apiKey) return fail(500, "server_not_configured");

  let response;
  try {
    response = await fetchImpl(buildSearchUrl(checked.query, page.token), { headers: { "x-goog-api-key": apiKey } });
  } catch {
    return fail(502, "upstream_error");
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    // fall through: handled below
  }

  if (!response.ok) {
    const reasons = (json?.error?.errors ?? []).map((e) => e?.reason);
    if (response.status === 403 && reasons.some((r) => QUOTA_REASONS.includes(r))) return fail(429, "quota_exceeded");
    return fail(502, "upstream_error");
  }
  if (!json) return fail(502, "upstream_error");

  const next = typeof json.nextPageToken === "string" && PAGE_TOKEN_RE.test(json.nextPageToken) ? json.nextPageToken : null;
  return { status: 200, body: { query: checked.query, results: normalizeItems(json), nextPageToken: next }, cache: CACHE_OK };
}
