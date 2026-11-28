const KEYS = {
  searches: "dibus.searches.v1",
  watched: "dibus.watched.v1",
  lastResults: "dibus.lastResults.v1",
};
const LIMIT = 200;

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full; playback and search should still work.
  }
}

function upsert(key, item, identity) {
  const items = read(key).filter((entry) => entry[identity] !== item[identity]);
  items.unshift(item);
  write(key, items.slice(0, LIMIT));
}

export function getSearchHistory() { return read(KEYS.searches); }
export function getWatchHistory() { return read(KEYS.watched); }
export function addSearch(query) {
  const value = query.trim();
  if (!value) return;
  upsert(KEYS.searches, { query: value, timestamp: Date.now() }, "query");
}
export function addWatched(video) {
  if (!video?.id) return;
  upsert(KEYS.watched, {
    id: video.id,
    title: video.title || "Untitled video",
    channel: video.channel || "",
    timestamp: Date.now(),
  }, "id");
}
export function removeSearch(query) {
  write(KEYS.searches, getSearchHistory().filter((item) => item.query !== query));
}
export function removeWatched(id) {
  write(KEYS.watched, getWatchHistory().filter((item) => item.id !== id));
}
export function clearHistory() {
  write(KEYS.searches, []);
  write(KEYS.watched, []);
}
export function clearRecent() {
  write(KEYS.searches, []);
  write(KEYS.watched, []);
}
export function saveLastResults(query, results) {
  try { localStorage.setItem(KEYS.lastResults, JSON.stringify({ query, results })); } catch { /* optional persistence */ }
}
export function getLastResults() {
  try {
    const value = JSON.parse(localStorage.getItem(KEYS.lastResults) || "null");
    return value && Array.isArray(value.results) ? value : null;
  } catch { return null; }
}
export function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today - day) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
