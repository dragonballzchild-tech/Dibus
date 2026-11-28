import { describe, it, expect, vi } from "vitest";
import { handleSearchRequest, isValidPageToken } from "../lib/search-core.js";

describe("isValidPageToken", () => {
  it("accepts empty or valid tokens and rejects malformed ones", () => {
    expect(isValidPageToken(null)).toBe(true);
    expect(isValidPageToken("")).toBe(true);
    expect(isValidPageToken("CDIQAA")).toBe(true);
    expect(isValidPageToken("abc_123-XYZ")).toBe(true);
    expect(isValidPageToken("bad token!")).toBe(false);
  });
});

describe("handleSearchRequest", () => {
  it("returns 400 on empty query", async () => {
    const req = new Request("https://example.com/api/search?q=   ");
    const res = await handleSearchRequest(req, { apiKey: "secret-key", fetchImpl: vi.fn() });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid pageToken", async () => {
    const req = new Request("https://example.com/api/search?q=coffee&pageToken=bad!token");
    const res = await handleSearchRequest(req, { apiKey: "secret-key", fetchImpl: vi.fn() });
    expect(res.status).toBe(400);
  });

  it("returns normalized results, nextPageToken, and CDN cache header on success", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          nextPageToken: "CDIQAA",
          items: [
            {
              id: { videoId: "dQw4w9WgXcQ" },
              snippet: {
                title: "Espresso Guide",
                channelTitle: "Coffee Lab",
                publishedAt: "2025-05-01T00:00:00Z",
                thumbnails: { high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } },
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const req = new Request("https://example.com/api/search?q=espresso&pageToken=CAoQAA");
    const res = await handleSearchRequest(req, { apiKey: "secret-key", fetchImpl: mockFetch });

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");

    const body = await res.json();
    expect(body.nextPageToken).toBe("CDIQAA");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("dQw4w9WgXcQ");
  });

  it("returns 429 with quota message when YouTube responds 403 quotaExceeded", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { errors: [{ reason: "quotaExceeded" }] },
        }),
        { status: 403 }
      )
    );

    const req = new Request("https://example.com/api/search?q=espresso");
    const res = await handleSearchRequest(req, { apiKey: "secret-key", fetchImpl: mockFetch });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.error).toContain("Search limit reached");
  });

  it("returns 502 on upstream failure without leaking the API key", async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error("Network down");
    });

    const req = new Request("https://example.com/api/search?q=espresso");
    const res = await handleSearchRequest(req, { apiKey: "super-secret-key", fetchImpl: mockFetch });
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(text).not.toContain("super-secret-key");
  });
});
