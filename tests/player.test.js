import { describe, it, expect } from "vitest";
import { embedUrl, watchUrl, isEmbedError, parseMessage } from "../src/player.js";

describe("player helpers", () => {
  it("builds a nocookie embed url", () => {
    const url = new URL(embedUrl("dQw4w9WgXcQ", "https://dibus.pages.dev"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(url.searchParams.get("origin")).toBe("https://dibus.pages.dev");
    expect(url.searchParams.get("rel")).toBe("0");
  });

  it("builds a watch url", () => {
    expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("parses string and object messages safely", () => {
    expect(parseMessage('{"a":1}')).toEqual({ a: 1 });
    expect(parseMessage({ a: 1 })).toEqual({ a: 1 });
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage(42)).toBeNull();
    expect(parseMessage(null)).toBeNull();
  });

  it("detects embed errors only", () => {
    expect(isEmbedError('{"event":"onError","info":150}')).toBe(true);
    expect(isEmbedError({ event: "onError", info: 101 })).toBe(true);
    expect(isEmbedError({ event: "onError", info: 5 })).toBe(false);
    expect(isEmbedError({ event: "onReady" })).toBe(false);
    expect(isEmbedError("garbage")).toBe(false);
  });
});
