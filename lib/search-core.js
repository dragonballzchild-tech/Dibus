const MAX_QUERY_LENGTH = 100;
const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{1,64}$/;
const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function isValidPageToken(token) {
  if (token === null || token === undefined || token === "") return true;
  return typeof token === "string" && PAGE_TOKEN_RE.test(token);
}

export function normalizeYouTubeItem(item) {
  const videoId = item?.id?.videoId;
  if (!videoId || typeof videoId !== "string") return null;

  const snippet = item.snippet ?? {};
  const thumbs = snippet.thumbnails ?? {};
  const thumbnail = thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || "";

  return {
    id: videoId,
    title: typeof snippet.title === "string" && snippet.title.trim() ? snippet.title : "Untitled video",
    channelTitle:
      typeof snippet.channelTitle === "string" && snippet.channelTitle.trim()
        ? snippet.channelTitle
        : "Unknown channel",
    publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
    thumbnail,
  };
}

export async function handleSearchRequest(request, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) {
    return jsonResponse({ error: "Server configuration error.", code: "MISSING_API_KEY" }, 500);
  }

  let url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    return jsonResponse({ error: "Invalid request URL.", code: "INVALID_REQUEST" }, 400);
  }

  const rawQuery = url.searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  if (!query) {
    return jsonResponse({ error: "Missing search query.", code: "EMPTY_QUERY" }, 400);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse(
      { error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer.`, code: "QUERY_TOO_LONG" },
      400
    );
  }

  const pageToken = url.searchParams.get("pageToken");
  if (!isValidPageToken(pageToken)) {
    return jsonResponse({ error: "Invalid page token.", code: "INVALID_PAGE_TOKEN" }, 400);
  }

  const ytParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "50",
    q: query,
    key: apiKey,
  });

  if (pageToken) {
    ytParams.set("pageToken", pageToken);
  }

  let upstream;
  try {
    upstream = await fetchImpl(`${YOUTUBE_SEARCH_ENDPOINT}?${ytParams.toString()}`);
  } catch {
    return jsonResponse(
      { error: "Unable to reach YouTube search right now.", code: "UPSTREAM_NETWORK" },
      502
    );
  }

  let data = null;
  try {
    data = await upstream.json();
  } catch {
    data = null;
  }

  if (!upstream.ok) {
    const reasons = Array.isArray(data?.error?.errors)
      ? data.error.errors.map((entry) => entry.reason)
      : [];
    const isQuota =
      upstream.status === 403 &&
      (reasons.includes("quotaExceeded") ||
        reasons.includes("dailyLimitExceeded") ||
        reasons.includes("rateLimitExceeded"));

    if (isQuota || upstream.status === 429) {
      return jsonResponse(
        {
          error: "Search limit reached for today, paste a link instead",
          code: "QUOTA_EXCEEDED",
        },
        429
      );
    }

    return jsonResponse(
      {
        error: "YouTube search is temporarily unavailable.",
        code: "UPSTREAM_ERROR",
      },
      502
    );
  }

  const items = Array.isArray(data?.items)
    ? data.items.map(normalizeYouTubeItem).filter(Boolean)
    : [];

  return jsonResponse(
    {
      items,
      nextPageToken: typeof data?.nextPageToken === "string" ? data.nextPageToken : null,
    },
    200,
    {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    }
  );
}
