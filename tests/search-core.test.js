import { describe, expect, it, vi } from "vitest";
import { handleSearch, normalizeYouTubeItems } from "../lib/search-core.js";

const sample = {
  id: { videoId: "dQw4w9WgXcQ" },
  snippet: { title: "Example", channelTitle: "Channel", publishedAt: "2026-01-01T00:00:00Z", thumbnails: { medium: { url: "https://img.example/thumb.jpg" } } },
};

describe("normalizeYouTubeItems", () => {
  it("normalizes expected fields and filters invalid IDs", () => {
    expect(normalizeYouTubeItems([sample, { id: { videoId: "bad" }, snippet: {} }])).toEqual([{
      id: "dQw4w9WgXcQ", title: "Example", channel: "Channel", publishedAt: "2026-01-01T00:00:00Z",
      thumbnails: { default: "", medium: "https://img.example/thumb.jpg", high: "https://img.example/thumb.jpg" },
    }]);
  });
  it("handles missing fields", () => {
    expect(normalizeYouTubeItems([{ id: { videoId: "abcdefghijk" } }])[0].title).toBe("Untitled video");
  });
});

describe("handleSearch", () => {
  it("rejects empty and overlong queries", async () => {
    const empty = await handleSearch(new Request("https://dibus.test/api/search?q="), { apiKey: "key" });
    const long = await handleSearch(new Request(`https://dibus.test/api/search?q=${"a".repeat(101)}`), { apiKey: "key" });
    expect(empty.status).toBe(400);
    expect(long.status).toBe(400);
  });
  it("reports missing API key", async () => {
    const response = await handleSearch(new Request("https://dibus.test/api/search?q=cars"), { apiKey: "" });
    expect(response.status).toBe(503);
  });
  it("proxies successful searches and caches for one hour", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [sample] }), { status: 200 }));
    const response = await handleSearch(new Request("https://dibus.test/api/search?q=cars"), { apiKey: "secret", fetchImpl });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect((await response.json()).items[0].id).toBe("dQw4w9WgXcQ");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0].searchParams.get("key")).toBe("secret");
  });
  it("handles quota exceeded", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }), { status: 403 }));
    const response = await handleSearch(new Request("https://dibus.test/api/search?q=cars"), { apiKey: "secret", fetchImpl });
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("QUOTA_EXCEEDED");
  });
  it("handles upstream failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const response = await handleSearch(new Request("https://dibus.test/api/search?q=cars"), { apiKey: "secret", fetchImpl });
    expect(response.status).toBe(502);
  });
});
