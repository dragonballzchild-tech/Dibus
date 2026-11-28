export async function searchVideos(query, { signal } = {}) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Search failed. Please try again.");
    error.code = payload.code || "SEARCH_FAILED";
    error.status = response.status;
    throw error;
  }
  return normalizeResults(payload.items);
}

export function normalizeResults(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || "Untitled video"),
    channel: String(item.channel || "Unknown channel"),
    publishedAt: item.publishedAt || "",
    thumbnails: item.thumbnails || {},
  })).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id));
}
