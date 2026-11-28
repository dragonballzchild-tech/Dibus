import { describe, it, expect, vi, afterEach } from "vitest";
import handler from "../api/search.js";

const KEY = "SECRET-TEST-KEY-123";
const call = (path, init) => handler.fetch(new Request(`https://dibus.example${path}`, init));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/search", () => {
  it("returns JSON results with edge-cache headers", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", KEY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ id: { videoId: "dQw4w9WgXcQ" }, snippet: { title: "Hi &amp; bye", channelTitle: "C", thumbnails: {} } }] }),
    }));
    const res = await call("/api/search?q=cars");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    const data = await res.json();
    expect(data.results[0].title).toBe("Hi & bye");
    expect(JSON.stringify(data)).not.toContain(KEY);
  });

  it("forwards pageToken and returns nextPageToken", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", KEY);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [], nextPageToken: "CDIQAA" }) });
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("/api/search?q=cars&pageToken=CAUQAA");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("pageToken")).toBe("CAUQAA");
    expect((await res.json()).nextPageToken).toBe("CDIQAA");
  });

  it("returns 400 for a malformed pageToken", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", KEY);
    const res = await call("/api/search?q=cars&pageToken=bad%20token");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_page_token" });
  });

  it("returns 400 and no caching for a missing query", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", KEY);
    const res = await call("/api/search");
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "missing_query" });
  });

  it("returns 500 server_not_configured when the key is missing", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const res = await call("/api/search?q=cars");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_not_configured" });
  });

  it("rejects other methods", async () => {
    const res = await call("/api/search?q=cars", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("answers HEAD without a body", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const res = await call("/api/search?q=cars", { method: "HEAD" });
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("");
  });
});
