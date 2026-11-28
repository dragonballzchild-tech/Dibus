import { handleSearchRequest } from "../lib/search-core.js";

export async function GET(request) {
  return handleSearchRequest(request, {
    apiKey: process.env.YOUTUBE_API_KEY,
    fetchImpl: fetch,
  });
}
