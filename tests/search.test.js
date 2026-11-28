import { describe, it, expect, vi } from "vitest";
import {
  normalizeQuery,
  searchVideos,
  errorMessage,
  formatRelativeDate,
  SearchError,
  nextBatch,
  mergeResults,
  canLoadMore,
  endMessage,
  REVEAL_SIZE,
  MAX_LOADED,
} from "../src/search.js";

const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const good = { id: "dQw4w9WgXcQ", title: "T", channel: "C", thumbnail: "t.jpg", publishedAt: "2026-01-01T00:00:00Z" };

describe("normalizeQuery", () => {
  it("trims, collapses spaces and lowercases so equal searches share a cache entry", () => {
    expect(normalizeQuery("  Best   CARS \n 2026 ")).toBe("best cars 2026");
    expect(normalizeQuery(null)).toBe("");
  });
});

describe("searchVideos", () => {
  it("requests our own endpoint with an encoded query and returns results and the next page token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ query: "a&b", results: [good], nextPageToken: "CDIQAA" }));
    expect(await searchVideos("a&b", { fetchImpl })).toEqual({ results: [good], nextPageToken: "CDIQAA" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/search?q=a%26b");
  });

  it("sends the page token for the next page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ results: [good], nextPageToken: null }));
    const page = await searchVideos("cars", { pageToken: "CAUQ-A_", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("/api/search?q=cars&pageToken=CAUQ-A_");
    expect(page.nextPageToken).toBeNull();
  });

  it("treats a missing or empty next page token as the last page", async () => {
    for (const body of [{ results: [good] }, { results: [good], nextPageToken: "" }, { results: [good], nextPageToken: 7 }]) {
      const page = await searchVideos("x", { fetchImpl: vi.fn().mockResolvedValue(reply(body)) });
      expect(page.nextPageToken).toBeNull();
    }
  });

  it("drops malformed results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ results: [good, null, { id: 5 }, { title: "x" }] }));
    expect((await searchVideos("x", { fetchImpl })).results).toEqual([good]);
  });

  it.each([
    ["quota", reply({ error: "quota_exceeded" }, 429), "quota_exceeded"],
    ["too long", reply({ error: "query_too_long" }, 400), "query_too_long"],
    ["upstream error", reply({ error: "upstream_error" }, 502), "unavailable"],
    ["not configured", reply({ error: "server_not_configured" }, 500), "unavailable"],
    ["html error page", { ok: false, status: 404, json: async () => { throw new Error("not json"); } }, "unavailable"],
    ["ok but wrong shape", reply({ nope: true }), "unavailable"],
  ])("maps %s to %s", async (_name, response, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(response);
    await expect(searchVideos("x", { fetchImpl })).rejects.toMatchObject({ code });
  });

  it("maps a network failure to network", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await searchVideos("x", { fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(SearchError);
    expect(error.code).toBe("network");
  });
});

describe("errorMessage", () => {
  it("has a friendly message for every code, mentioning link pasting where useful", () => {
    expect(errorMessage("quota_exceeded")).toContain("Paste a YouTube link");
    expect(errorMessage("query_too_long")).toContain("too long");
    expect(errorMessage("network")).toContain("connection");
    expect(errorMessage("anything else")).toContain("paste a YouTube link");
  });
});

describe("formatRelativeDate", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  it.each([
    ["2026-11-27T11:59:30Z", "just now"],
    ["2026-11-27T11:55:00Z", "5 minutes ago"],
    ["2026-11-27T09:00:00Z", "3 hours ago"],
    ["2026-11-26T09:00:00Z", "yesterday"],
    ["2026-11-24T12:00:00Z", "3 days ago"],
    ["2026-11-13T12:00:00Z", "2 weeks ago"],
    ["2026-09-20T12:00:00Z", "2 months ago"],
    ["2024-02-07T14:00:21Z", "2 years ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatRelativeDate(iso, now)).toBe(expected);
  });
  it("returns empty text for missing or invalid dates and never goes negative", () => {
    expect(formatRelativeDate("", now)).toBe("");
    expect(formatRelativeDate("garbage", now)).toBe("");
    expect(formatRelativeDate("2026-11-28T12:00:00Z", now)).toBe("just now");
  });
});

describe("nextBatch", () => {
  it("reveals one batch at a time and never passes the total", () => {
    expect(REVEAL_SIZE).toBe(12);
    expect(nextBatch(0, 50)).toBe(12);
    expect(nextBatch(12, 50)).toBe(24);
    expect(nextBatch(48, 50)).toBe(50);
    expect(nextBatch(50, 50)).toBe(50);
    expect(nextBatch(0, 5)).toBe(5);
    expect(nextBatch(0, 0)).toBe(0);
  });
});

describe("mergeResults", () => {
  const v = (id) => ({ id, title: id });
  it("appends new videos in order and skips ones already loaded", () => {
    expect(mergeResults([v("a"), v("b")], [v("b"), v("c")]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("skips duplicates within the incoming page and does not change the original", () => {
    const existing = [v("a")];
    expect(mergeResults(existing, [v("x"), v("x")]).map((r) => r.id)).toEqual(["a", "x"]);
    expect(existing).toHaveLength(1);
  });
});

describe("canLoadMore and endMessage", () => {
  it("offers Load more only when YouTube has more and we are under the cap", () => {
    expect(MAX_LOADED).toBe(150);
    expect(canLoadMore(50, "CDIQAA")).toBe(true);
    expect(canLoadMore(100, "CDIQAA")).toBe(true);
    expect(canLoadMore(150, "CDIQAA")).toBe(false);
    expect(canLoadMore(50, null)).toBe(false);
  });
  it("explains why the list ends", () => {
    expect(endMessage(5, null)).toBe("End of results");
    expect(endMessage(150, "CDIQAA")).toBe("That’s all for now. Try a more specific search.");
    expect(endMessage(150, null)).toBe("End of results");
    expect(endMessage(50, "CDIQAA")).toBe("");
  });
});
