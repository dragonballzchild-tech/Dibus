// Pure helpers for turning user input into a YouTube video ID. No DOM access.

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
// An 11-letter plain word ("photography", "Photography") is far more likely a search than an ID.
const WORD_RE = /^[A-Z]?[a-z]+$/;
const HOST_PREFIX_RE = /^(www\.|m\.|music\.)/;

const pick = (id) => (ID_RE.test(id ?? "") ? id : null);

/** Returns the 11-character video ID found in `input`, or null. Accepts links and bare IDs. */
export function parseVideoId(input) {
  const text = (input ?? "").trim();
  if (!text) return null;
  if (ID_RE.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(HOST_PREFIX_RE, "");
  if (host === "youtu.be") return pick(url.pathname.split("/")[1]);

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return pick(url.searchParams.get("v"));
    const m = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/);
    if (m) return pick(m[1]);
  }
  return null;
}

/** Decides what the single search bar should do with what was typed or pasted. */
export function classifyInput(input) {
  const text = (input ?? "").trim();
  if (!text) return { type: "empty" };
  if (ID_RE.test(text) && WORD_RE.test(text)) return { type: "search", query: text };
  const id = parseVideoId(text);
  return id ? { type: "video", id } : { type: "search", query: text };
}
