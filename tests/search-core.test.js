import { describe, it, expect, vi } from "vitest";
import {
  validateQuery,
  validatePageToken,
  buildSearchUrl,
  decodeEntities,
  normalizeItems,
  handleSearch,
  MAX_QUERY_LENGTH,
  CACHE_OK,
  CACHE_NONE,
} from "../lib/search-core.js";

const KEY = "SECRET-TEST-KEY-123";
const ok = (json, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
const item = (id, over = {}) => ({
  id: { videoId: id },
  snippet: {
    title: "A title",
    channelTitle: "A channel",
    publishedAt: "2026-01-02T03:04:05Z",
    thumbnails: { default: { url: "d.jpg" }, medium: { url: "m.jpg" }, high: { url: "h.jpg" } },
    ...over,
  },
});

describe("validateQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(validateQuery("  best   cars \n 2026 ")).toEqual({ ok: true, query: "best cars 2026" });
  });
  it("rejects empty, blank and missing", () => {
    for (const bad of ["", "   ", null, undefined]) expect(validateQuery(bad)).toEqual({ ok: false, error: "missing_query" });
  });
  it("rejects over-long queries but accepts the limit", () => {
    expect(validateQuery("a".repeat(MAX_QUERY_LENGTH + 1))).toEqual({ ok: false, error: "query_too_long" });
    expect(validateQuery("a".repeat(MAX_QUERY_LENGTH)).ok).toBe(true);
  });
});

describe("buildSearchUrl", () => {
  it("asks for 50 videos and never includes a key", () => {
    const url = new URL(buildSearchUrl("cars & trucks"));
    expect(url.searchParams.get("q")).toBe("cars & trucks");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("maxResults")).toBe("50");
    expect(url.searchParams.has("pageToken")).toBe(false);
    expect(url.searchParams.has("key")).toBe(false);
  });
  it("adds the page token when given", () => {
    expect(new URL(buildSearchUrl("cars", "CDIQAA")).searchParams.get("pageToken")).toBe("CDIQAA");
  });
});

describe("validatePageToken", () => {
  it("treats missing tokens as the first page", () => {
    for (const none of [undefined, null, ""]) expect(validatePageToken(none)).toEqual({ ok: true, token: null });
  });
  it("accepts YouTube-style tokens", () => {
    expect(validatePageToken("CDIQAA")).toEqual({ ok: true, token: "CDIQAA" });
    expect(validatePageToken("a-b_C9")).toEqual({ ok: true, token: "a-b_C9" });
    expect(validatePageToken("x".repeat(100)).ok).toBe(true);
  });
  it("rejects anything else", () => {
    for (const bad of ["x".repeat(101), "has space", "semi;colon", "a/b", "<script>", 42, {}]) {
      expect(validatePageToken(bad)).toEqual({ ok: false, error: "bad_page_token" });
    }
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Tom &amp; Jerry &#39;s &quot;best&quot; &#x41;")).toBe("Tom & Jerry 's \"best\" A");
  });
  it("leaves unknown or malformed entities alone", () => {
    expect(decodeEntities("&nope; &#99999999; &")).toBe("&nope; &#99999999; &");
  });
});

describe("normalizeItems", () => {
  it("maps items and prefers the medium thumbnail", () => {
    expect(normalizeItems({ items: [item("dQw4w9WgXcQ", { title: "Rock &amp; Roll" })] })).toEqual([
      { id: "dQw4w9WgXcQ", title: "Rock & Roll", channel: "A channel", thumbnail: "m.jpg", publishedAt: "2026-01-02T03:04:05Z" },
    ]);
  });
  it("falls back through thumbnail sizes and tolerates missing fields", () => {
    const out = normalizeItems({ items: [item("dQw4w9WgXcQ", { thumbnails: { default: { url: "d.jpg" } } }), { id: { videoId: "aaaaaaaaaaa" } }] });
    expect(out[0].thumbnail).toBe("d.jpg");
    expect(out[1]).toMatchObject({ title: "", channel: "", thumbnail: "", publishedAt: "" });
  });
  it("trims stray whitespace from titles and channels", () => {
    const out = normalizeItems({ items: [item("dQw4w9WgXcQ", { title: "  Hello ", channelTitle: "Disney Jr. " })] });
    expect(out[0]).toMatchObject({ title: "Hello", channel: "Disney Jr." });
  });
  it("drops items without a valid video id (channels, playlists)", () => {
    expect(normalizeItems({ items: [{ id: { channelId: "x" }, snippet: {} }, item("short")] })).toEqual([]);
  });
  it("handles junk input", () => {
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems({ items: "nope" })).toEqual([]);
  });
});

describe("handleSearch", () => {
  it("returns normalized results with cache headers and sends the key in a header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ items: [item("dQw4w9WgXcQ")] }));
    const res = await handleSearch({ query: " cars ", apiKey: KEY, fetchImpl });
    expect(res.status).toBe(200);
    expect(res.cache).toBe(CACHE_OK);
    expect(res.body.query).toBe("cars");
    expect(res.body.results).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).not.toContain(KEY);
    expect(init.headers["x-goog-api-key"]).toBe(KEY);
    expect(JSON.stringify(res)).not.toContain(KEY);
  });

  it("passes the page token to YouTube and returns nextPageToken", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ items: [item("dQw4w9WgXcQ")], nextPageToken: "CDIQAA" }));
    const res = await handleSearch({ query: "cars", pageToken: "CAUQAA", apiKey: KEY, fetchImpl });
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get("pageToken")).toBe("CAUQAA");
    expect(res.body.nextPageToken).toBe("CDIQAA");
  });

  it("returns a null nextPageToken when YouTube has no more pages or sends an odd token", async () => {
    const none = await handleSearch({ query: "cars", apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(ok({ items: [] })) });
    expect(none.body.nextPageToken).toBeNull();
    const odd = await handleSearch({ query: "cars", apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(ok({ items: [], nextPageToken: "bad token!" })) });
    expect(odd.body.nextPageToken).toBeNull();
  });

  it("rejects a bad page token without calling YouTube", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSearch({ query: "cars", pageToken: "bad token!", apiKey: KEY, fetchImpl });
    expect(res).toEqual({ status: 400, body: { error: "bad_page_token" }, cache: CACHE_NONE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects bad queries without calling YouTube", async () => {
    const fetchImpl = vi.fn();
    expect(await handleSearch({ query: "", apiKey: KEY, fetchImpl })).toEqual({ status: 400, body: { error: "missing_query" }, cache: CACHE_NONE });
    expect((await handleSearch({ query: "x".repeat(101), apiKey: KEY, fetchImpl })).body.error).toBe("query_too_long");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing key without calling YouTube", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSearch({ query: "cars", apiKey: undefined, fetchImpl });
    expect(res).toEqual({ status: 500, body: { error: "server_not_configured" }, cache: CACHE_NONE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps quota errors to 429 quota_exceeded", async () => {
    for (const reason of ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"]) {
      const fetchImpl = vi.fn().mockResolvedValue(ok({ error: { errors: [{ reason }] } }, 403));
      const res = await handleSearch({ query: "cars", apiKey: KEY, fetchImpl });
      expect(res).toEqual({ status: 429, body: { error: "quota_exceeded" }, cache: CACHE_NONE });
    }
  });

  it("maps other upstream failures to 502 upstream_error", async () => {
    const cases = [
      ok({ error: { errors: [{ reason: "keyInvalid" }] } }, 400),
      ok({ error: { errors: [{ reason: "forbidden" }] } }, 403),
      ok({}, 500),
    ];
    for (const response of cases) {
      const res = await handleSearch({ query: "cars", apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(response) });
      expect(res).toEqual({ status: 502, body: { error: "upstream_error" }, cache: CACHE_NONE });
    }
  });

  it("maps network errors and unreadable bodies to 502", async () => {
    const thrown = await handleSearch({ query: "cars", apiKey: KEY, fetchImpl: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(thrown.status).toBe(502);
    const unreadable = { ok: true, status: 200, json: async () => { throw new Error("bad json"); } };
    expect((await handleSearch({ query: "cars", apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(unreadable) })).status).toBe(502);
  });

  it("returns an empty list when YouTube finds nothing", async () => {
    const res = await handleSearch({ query: "zzzz", apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(ok({ items: [] })) });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
