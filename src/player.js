// Pure helpers for the embedded player. No DOM access.

export const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
// YouTube player error codes: invalid id, not found, embedding disabled, missing referrer.
const EMBED_ERROR_CODES = [2, 100, 101, 150, 153];

export function embedUrl(id, origin) {
  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", enablejsapi: "1" });
  if (origin) params.set("origin", origin);
  return `${EMBED_ORIGIN}/embed/${id}?${params}`;
}

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export function parseMessage(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/** True when a postMessage from the player reports that the video can't be played. */
export function isEmbedError(raw) {
  const msg = parseMessage(raw);
  return msg?.event === "onError" && EMBED_ERROR_CODES.includes(Number(msg.info));
}
