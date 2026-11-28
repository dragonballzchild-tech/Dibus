import { describe, it, expect } from "vitest";
import { sidebarTitle } from "../src/view.js";

describe("sidebarTitle", () => {
  it("names the search the list came from", () => {
    expect(sidebarTitle("cars")).toBe("Results for “cars”");
    expect(sidebarTitle("  best   cars ")).toBe("Results for “best   cars”");
  });
  it("falls back to a plain heading without a query", () => {
    for (const none of ["", "   ", null, undefined]) expect(sidebarTitle(none)).toBe("Results");
  });
});
