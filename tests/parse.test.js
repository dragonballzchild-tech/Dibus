import { describe, expect, it } from "vitest";
import { parseVideoId } from "../src/parse.js";

const ID = "dQw4w9WgXcQ";

describe("parseVideoId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://m.youtube.com/watch?v=${ID}&t=30s`, ID],
    [`https://youtu.be/${ID}?si=abc`, ID],
    [`https://youtube.com/shorts/${ID}`, ID],
    [`https://youtube.com/live/${ID}`, ID],
    [`https://youtube.com/embed/${ID}`, ID],
    [ID, ID],
    [`youtu.be/${ID}`, ID],
  ])("parses %s", (input, expected) => expect(parseVideoId(input)).toBe(expected));

  it.each(["", "not a video", "https://example.com/watch?v=abcdefghijk", "https://youtube.com/watch?v=bad", "abcdefghij!"]) (
    "rejects %s", (input) => expect(parseVideoId(input)).toBeNull(),
  );
});
