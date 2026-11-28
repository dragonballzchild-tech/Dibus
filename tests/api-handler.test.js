import { afterEach, describe, expect, it } from "vitest";
import handler from "../api/search.js";

const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalApiKey;
});

describe("Vercel search function entry point", () => {
  it("exposes the documented fetch Web Standard handler", () => {
    expect(handler).toEqual({ fetch: expect.any(Function) });
  });

  it("returns a readable configuration error when the API key is missing", async () => {
    process.env.YOUTUBE_API_KEY = "";
    const response = await handler.fetch(new Request("https://dibus.test/api/search?q=cars"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Search is not configured yet. Add the YouTube API key in Vercel settings.",
      code: "NOT_CONFIGURED",
    });
  });

  it("rejects non-GET methods", async () => {
    const response = await handler.fetch(new Request("https://dibus.test/api/search", { method: "POST" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
});
