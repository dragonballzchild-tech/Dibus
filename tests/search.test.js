import { describe, it, expect } from "vitest";
import {
  normalizeSearchResult,
  mergeUniqueResults,
  revealNextBatch,
} from "../src/search.js";

describe("normalizeSearchResult", () => {
  it("normalizes a full YouTube API snippet item", () => {
    const item = {
      id: { videoId: "dQw4w9WgXcQ" },
      snippet: {
        title: "Test Video",
        channelTitle: "Test Channel",
        publishedAt: "2025-01-15T10:00:00Z",
        thumbnails: {
          high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
        },
      },
    };

    expect(normalizeSearchResult(item)).toEqual({
      id: "dQw4w9WgXcQ",
      title: "Test Video",
      channelTitle: "Test Channel",
      publishedAt: "2025-01-15T10:00:00Z",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("handles missing snippet fields with safe defaults", () => {
    const item = {
      id: { videoId: "abc12345678" },
      snippet: {},
    };

    expect(normalizeSearchResult(item)).toEqual({
      id: "abc12345678",
      title: "Untitled video",
      channelTitle: "Unknown channel",
      publishedAt: "",
      thumbnail: "",
    });
  });

  it("returns null when videoId is missing", () => {
    expect(normalizeSearchResult(null)).toBeNull();
    expect(normalizeSearchResult({ id: {} })).toBeNull();
  });
});

describe("mergeUniqueResults", () => {
  it("appends new items while skipping duplicate IDs", () => {
    const existing = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ];
    const incoming = [
      { id: "b", title: "B duplicate" },
      { id: "c", title: "C" },
      { id: "c", title: "C duplicate" },
    ];

    expect(mergeUniqueResults(existing, incoming)).toEqual([
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ]);
  });
});

describe("revealNextBatch", () => {
  it("reveals 12 more items at a time capped at total length", () => {
    const items = Array.from({ length: 30 }, (_, idx) => ({ id: String(idx) }));
    expect(revealNextBatch(items, 12, 12)).toBe(24);
    expect(revealNextBatch(items, 24, 12)).toBe(30);
    expect(revealNextBatch(items, 30, 12)).toBe(30);
  });
});
