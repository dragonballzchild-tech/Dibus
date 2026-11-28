import { handleSearch, jsonResponse } from "../lib/search-core.js";

export default async function handler(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
  }
  return handleSearch(request);
}
