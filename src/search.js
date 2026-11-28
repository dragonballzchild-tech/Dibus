function readErrorMessage(payload) {
  const candidates = [
    payload?.error,
    payload?.message,
    payload?.details,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object") {
      const nested = [candidate.message, candidate.description, candidate.details];
      for (const value of nested) {
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
  }

  return "Search failed. Please try again.";
}

export async function searchVideos(query, { signal } = {}) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(readErrorMessage(payload));
    error.code = payload?.code || payload?.error?.code || "SEARCH_FAILED";
    error.status = response.status;
    throw error;
  }

  if (!payload || !Array.isArray(payload.items)) {
    const error = new Error("The search service returned an unexpected response. Please try again later.");
    error.code = "INVALID_RESPONSE";
    throw error;
  }

  return normalizeResults(payload.items);
}

export function normalizeResults(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: typeof item?.id === "string" ? item.id : "",
    title: typeof item?.title === "string" ? item.title : "Untitled video",
    channel: typeof item?.channel === "string" ? item.channel : "Unknown channel",
    publishedAt: typeof item?.publishedAt === "string" ? item.publishedAt : "",
    thumbnails: item?.thumbnails && typeof item.thumbnails === "object" ? item.thumbnails : {},
  })).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id));
}
