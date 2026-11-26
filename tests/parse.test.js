import { describe, it, expect } from "vitest";
import { parseVideoId, classifyInput } from "../src/parse.js";

const ID = "dQw4w9WgXcQ";

describe("parseVideoId", () => {
  it.each([
    ["watch link", `https://www.youtube.com/watch?v=${ID}`],
    ["watch link without scheme", `youtube.com/watch?v=${ID}`],
    ["mobile link", `https://m.youtube.com/watch?v=${ID}`],
    ["music link", `https://music.youtube.com/watch?v=${ID}`],
    ["short link", `https://youtu.be/${ID}`],
    ["short link with tracking", `https://youtu.be/${ID}?si=abc123`],
    ["shorts link", `https://www.youtube.com/shorts/${ID}`],
    ["live link", `https://www.youtube.com/live/${ID}`],
    ["embed link", `https://www.youtube.com/embed/${ID}`],
    ["nocookie embed link", `https://www.youtube-nocookie.com/embed/${ID}`],
    ["extra params", `https://www.youtube.com/watch?v=${ID}&t=30s&list=PL123`],
    ["v param not first", `https://www.youtube.com/watch?list=PL123&v=${ID}`],
    ["trailing slash", `https://youtu.be/${ID}/`],
    ["uppercase host", `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`],
    ["surrounding spaces", `  ${ID}  `],
    ["bare id", ID],
  ])("accepts %s", (_name, input) => {
    expect(parseVideoId(input)).toBe(ID);
  });

  it("accepts a bare id containing - and _", () => {
    expect(parseVideoId("a-b_c-d_e-1")).toBe("a-b_c-d_e-1");
  });

  it.each([
    ["empty", ""],
    ["null", null],
    ["plain words", "funny cat videos"],
    ["other site", `https://vimeo.com/watch?v=${ID}`],
    ["lookalike host", `https://notyoutube.com/watch?v=${ID}`],
    ["too short id", "https://youtu.be/abc"],
    ["watch without v", "https://www.youtube.com/watch"],
    ["channel page", "https://www.youtube.com/@somechannel"],
    ["id with bad characters", "https://youtu.be/dQw4w9WgX<>"],
  ])("rejects %s", (_name, input) => {
    expect(parseVideoId(input)).toBeNull();
  });
});

describe("classifyInput", () => {
  it("treats blank input as empty", () => {
    expect(classifyInput("   ")).toEqual({ type: "empty" });
    expect(classifyInput(undefined)).toEqual({ type: "empty" });
  });

  it("plays links and bare ids", () => {
    expect(classifyInput(`https://youtu.be/${ID}`)).toEqual({ type: "video", id: ID });
    expect(classifyInput(ID)).toEqual({ type: "video", id: ID });
  });

  it("searches for everything else", () => {
    expect(classifyInput("  best cars 2026 ")).toEqual({ type: "search", query: "best cars 2026" });
    expect(classifyInput("cars.com")).toEqual({ type: "search", query: "cars.com" });
  });

  it("searches for 11-letter plain words instead of treating them as ids", () => {
    expect(classifyInput("photography")).toEqual({ type: "search", query: "photography" });
    expect(classifyInput("Photography")).toEqual({ type: "search", query: "Photography" });
  });
});
