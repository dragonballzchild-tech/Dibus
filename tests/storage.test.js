import { describe, it, expect } from "vitest";
import {
  STORAGE_KEYS,
  addSearchHistory,
  addWatchedVideo,
  clearHistoryList,
  formatRelativeTime,
  removeHistoryItem,
} from "../src/storage.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

describe("storage history helpers", () => {
  it("collapses duplicates and moves re-watched items to the top", () => {
    const storage = createMemoryStorage();
    addWatchedVideo({ id: "v1", title: "First" }, storage, 1000);
    addWatchedVideo({ id: "v2", title: "Second" }, storage, 2000);
    const updated = addWatchedVideo({ id: "v1", title: "First" }, storage, 3000);

    expect(updated.map((item) => item.id)).toEqual(["v1", "v2"]);
  });

  it("caps history at 200 entries", () => {
    const storage = createMemoryStorage();
    for (let i = 0; i < 205; i += 1) {
      addSearchHistory(`query-${i}`, storage, i);
    }
    const list = JSON.parse(storage.getItem(STORAGE_KEYS.searches));
    expect(list).toHaveLength(200);
    expect(list[0].query).toBe("query-204");
  });

  it("removes a single item and clears all items", () => {
    const storage = createMemoryStorage();
    addSearchHistory("one", storage, 1);
    addSearchHistory("two", storage, 2);

    const afterRemove = removeHistoryItem(STORAGE_KEYS.searches, "query", "one", storage);
    expect(afterRemove.map((x) => x.query)).toEqual(["two"]);

    const afterClear = clearHistoryList(STORAGE_KEYS.searches, storage);
    expect(afterClear).toEqual([]);
  });

  it("formats Today and Yesterday relative labels", () => {
    const now = new Date("2026-11-28T12:00:00Z").getTime();
    expect(formatRelativeTime(now, now)).toBe("Today");
    expect(formatRelativeTime(now - 86400000, now)).toBe("Yesterday");
  });
});
