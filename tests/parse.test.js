import { describe, it, expect } from "vitest";
import { parseVideoId, isValidVideoId } from "../src/parse.js";

describe("parseVideoId", () => {
  it("accepts a bare 11-character video ID", () => {
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("  abc_def-123  ")).toBe("abc_def-123");
  });

  it("extracts ID from standard youtube.com/watch URLs and extra params", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be short links", () => {
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ?si=sharetoken&t=12")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from shorts, live, and embed URLs", () => {
    expect(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://www.youtube.com/live/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for invalid or non-YouTube inputs", () => {
    expect(parseVideoId("")).toBeNull();
    expect(parseVideoId("   ")).toBeNull();
    expect(parseVideoId(null)).toBeNull();
    expect(parseVideoId("too-short")).toBeNull();
    expect(parseVideoId("https://vimeo.com/12345678901")).toBeNull();
    expect(parseVideoId("https://www.youtube.com/watch?v=bad")).toBeNull();
    expect(parseVideoId("cats playing piano")).toBeNull();
  });
});

describe("isValidVideoId", () => {
  it("validates 11-char IDs strictly", () => {
    expect(isValidVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidVideoId("bad")).toBe(false);
    expect(isValidVideoId("dQw4w9WgXcQ!")).toBe(false);
  });
});
