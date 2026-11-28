const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const pick = (id) => (ID_RE.test(id ?? "") ? id : null);

export function parseVideoId(input) {
  const text = (input ?? "").trim();
  if (ID_RE.test(text)) return text;

  let url;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return pick(url.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com") {
    if (url.pathname === "/watch") return pick(url.searchParams.get("v"));
    const match = url.pathname.match(/^\/(shorts|live|embed)\/([^/?]+)/);
    if (match) return pick(match[2]);
  }
  return null;
}
