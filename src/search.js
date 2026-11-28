export const DEFAULT_BATCH_SIZE = 12;
export const MAX_RESULTS_PER_SEARCH = 150;

export function normalizeSearchResult(item) {
  if (!item || typeof item !== "object") return null;

  const rawId = typeof item.id === "string" ? item.id : item.id?.videoId;
  if (!rawId || typeof rawId !== "string") return null;

  const snippet = item.snippet ?? item;
  const thumbs = snippet.thumbnails;
  const thumbnail =
    typeof item.thumbnail === "string"
      ? item.thumbnail
      : thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "";

  return {
    id: rawId,
    title: typeof snippet.title === "string" && snippet.title.trim() ? snippet.title : "Untitled video",
    channelTitle:
      typeof snippet.channelTitle === "string" && snippet.channelTitle.trim()
        ? snippet.channelTitle
        : "Unknown channel",
    publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
    thumbnail,
  };
}

export function mergeUniqueResults(existing, incoming) {
  const seen = new Set();
  const merged = [];

  for (const item of existing ?? []) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  for (const item of incoming ?? []) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

export function revealNextBatch(allItems, visibleCount, batchSize = DEFAULT_BATCH_SIZE) {
  const total = Array.isArray(allItems) ? allItems.length : 0;
  const current = Math.max(0, Number(visibleCount) || 0);
  const step = Math.max(1, Number(batchSize) || DEFAULT_BATCH_SIZE);
  return Math.min(total, current + step);
}

export async function fetchSearchResults(query, pageToken = null, fetchImpl = fetch) {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    throw new Error("Please enter a search query or YouTube link.");
  }

  const params = new URLSearchParams({ q: trimmed.slice(0, 100) });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetchImpl(`/api/search?${params.toString()}`);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = new Error(payload?.error || "Search failed. Please try again.");
    err.code = payload?.code || (response.status === 429 ? "QUOTA_EXCEEDED" : "SEARCH_ERROR");
    err.status = response.status;
    throw err;
  }

  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeSearchResult).filter(Boolean)
    : [];

  return {
    items,
    nextPageToken: typeof payload?.nextPageToken === "string" ? payload.nextPageToken : null,
  };
}
