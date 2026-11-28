import { describe, it, expect } from "vitest";
import { sidebarTitle, historyMode } from "../src/view.js";

describe("sidebarTitle", () => {
  it("names the search the list came from", () => {
    expect(sidebarTitle("cars")).toBe("Results for “cars”");
    expect(sidebarTitle("  best   cars ")).toBe("Results for “best   cars”");
  });
  it("falls back to a plain heading without a query", () => {
    for (const none of ["", "   ", null, undefined]) expect(sidebarTitle(none)).toBe("Results");
  });
});

describe("historyMode", () => {
  it("does nothing when the same video is picked again", () => {
    expect(historyMode("aaaaaaaaaaa", "aaaaaaaaaaa")).toBe("none");
    expect(historyMode("aaaaaaaaaaa", "aaaaaaaaaaa", "sidebar")).toBe("none");
  });
  it("pushes a new entry when a video opens from the search view or the bar", () => {
    expect(historyMode(null, "aaaaaaaaaaa")).toBe("push");
    expect(historyMode(null, "aaaaaaaaaaa", "sidebar")).toBe("push");
    expect(historyMode("aaaaaaaaaaa", "bbbbbbbbbbb")).toBe("push");
  });
  it("replaces the entry when another video is picked from the sidebar", () => {
    expect(historyMode("aaaaaaaaaaa", "bbbbbbbbbbb", "sidebar")).toBe("replace");
  });
});
