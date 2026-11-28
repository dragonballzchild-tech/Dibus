const MAX_QUERY_LENGTH = 100;

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function normalizeYouTubeItems(items = []) {
  return items.slice(0, 12).map((item) => {
    const snippet = item?.snippet || {};
    const id = typeof item?.id === "string" ? item.id : item?.id?.videoId;
    const thumbnails = snippet.thumbnails || {};
    return {
      id: typeof id === "string" ? id : "",
      title: typeof snippet.title === "string" ? snippet.title : "Untitled video",
      channel: typeof snippet.channelTitle === "string" ? snippet.channelTitle : "Unknown channel",
      publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
      thumbnails: {
        default: thumbnails.default?.url || "",
        medium: thumbnails.medium?.url || thumbnails.default?.url || "",
        high: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "",
      },
    };
  }).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id));
}

export async function handleSearch(request, { fetchImpl = fetch, apiKey = process.env.YOUTUBE_API_KEY } = {}) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (!query) return jsonResponse({ error: "Enter a search query.", code: "EMPTY_QUERY" }, 400);
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ error: "Search queries must be 100 characters or fewer.", code: "QUERY_TOO_LONG" }, 400);
  }
  if (!apiKey) {
    return jsonResponse({ error: "Search is not configured yet. Add the YouTube API key in Vercel settings.", code: "NOT_CONFIGURED" }, 503);
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "12",
    q: query,
    key: apiKey,
  }).toString();

  try {
    const upstream = await fetchImpl(endpoint, { headers: { Accept: "application/json" } });
    const payload = await upstream.json();
    if (!upstream.ok) {
      const reason = payload?.error?.errors?.[0]?.reason || "";
      if (upstream.status === 403 && ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason)) {
        return jsonResponse({ error: "Search limit reached for today, paste a link instead.", code: "QUOTA_EXCEEDED" }, 429, {
          "Cache-Control": "no-store",
        });
      }
      return jsonResponse({ error: "YouTube search is temporarily unavailable. Please try again later.", code: "UPSTREAM_ERROR" }, 502, { "Cache-Control": "no-store" });
    }
    return jsonResponse({ items: normalizeYouTubeItems(payload.items) }, 200, {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch {
    return jsonResponse({ error: "Could not reach YouTube. Check your connection and try again.", code: "NETWORK_ERROR" }, 502, { "Cache-Control": "no-store" });
  }
}
