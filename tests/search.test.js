import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeResults, searchVideos } from "../src/search.js";

const sample = {
  id: "dQw4w9WgXcQ",
  title: "Example video",
  channel: "Example channel",
  publishedAt: "2026-01-01T00:00:00Z",
  thumbnails: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchVideos", () => {
  it("returns normalized search results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [sample] }), { status: 200 }),
    ));

    await expect(searchVideos("classic cars")).resolves.toEqual([sample]);
  });

  it("converts an object-shaped API error into a readable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "YouTube API key is invalid.", code: "KEY_INVALID" } }), { status: 403 }),
    ));

    await expect(searchVideos("classic cars")).rejects.toMatchObject({
      message: "YouTube API key is invalid.",
      code: "KEY_INVALID",
      status: 403,
    });
  });

  it("shows a useful error for non-JSON server responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    ));

    await expect(searchVideos("classic cars")).rejects.toMatchObject({
      message: "Search failed. Please try again.",
      status: 500,
    });
  });

  it("rejects a malformed successful response instead of showing an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    ));

    await expect(searchVideos("classic cars")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});

describe("normalizeResults", () => {
  it("filters malformed video IDs and object-valued metadata", () => {
    expect(normalizeResults([sample, { ...sample, id: { videoId: sample.id } }, { ...sample, title: {} }])).toEqual([
      sample,
    ]);
  });
});
