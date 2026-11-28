// GET /api/search?q=<query>: asks YouTube for videos matching the query.
// The API key comes from the YOUTUBE_API_KEY environment variable and never reaches the browser.
import { handleSearch } from "../lib/search-core.js";

const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...baseHeaders, allow: "GET, HEAD", "cache-control": "no-store" },
      });
    }

    const params = new URL(request.url).searchParams;
    const { status, body, cache } = await handleSearch({
      query: params.get("q"),
      pageToken: params.get("pageToken"),
      apiKey: process.env.YOUTUBE_API_KEY,
    });
    return new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
      status,
      headers: { ...baseHeaders, "cache-control": cache },
    });
  },
};
