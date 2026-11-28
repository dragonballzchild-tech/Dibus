export const STORAGE_KEYS = {
  watched: "dibus:watched",
  searches: "dibus:searches",
  lastSearch: "dibus:lastSearch",
};

export const MAX_HISTORY_ENTRIES = 200;
export const MAX_RECENT_CHIPS = 8;

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readList(key, storage = getDefaultStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeList(key, items, storage = getDefaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function upsertHistoryItem(list, item, keyField, maxEntries = MAX_HISTORY_ENTRIES) {
  const value = item?.[keyField];
  if (!value) return list.slice(0, maxEntries);

  const filtered = list.filter((entry) => entry?.[keyField] !== value);
  return [item, ...filtered].slice(0, maxEntries);
}

export function addWatchedVideo(video, storage = getDefaultStorage(), now = Date.now()) {
  if (!video?.id) return [];
  const existing = readList(STORAGE_KEYS.watched, storage);
  const entry = {
    id: video.id,
    title: video.title || video.id,
    channelTitle: video.channelTitle || "",
    thumbnail: video.thumbnail || "",
    timestamp: now,
  };
  const updated = upsertHistoryItem(existing, entry, "id");
  writeList(STORAGE_KEYS.watched, updated, storage);
  return updated;
}

export function addSearchHistory(query, storage = getDefaultStorage(), now = Date.now()) {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];
  const existing = readList(STORAGE_KEYS.searches, storage);
  const entry = {
    query: trimmed,
    timestamp: now,
  };
  const updated = upsertHistoryItem(existing, entry, "query");
  writeList(STORAGE_KEYS.searches, updated, storage);
  return updated;
}

export function removeHistoryItem(key, keyField, value, storage = getDefaultStorage()) {
  const existing = readList(key, storage);
  const updated = existing.filter((entry) => entry?.[keyField] !== value);
  writeList(key, updated, storage);
  return updated;
}

export function clearHistoryList(key, storage = getDefaultStorage()) {
  writeList(key, [], storage);
  return [];
}

export function saveLastSearch(state, storage = getDefaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.lastSearch, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function loadLastSearch(storage = getDefaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEYS.lastSearch);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.query !== "string" || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  if (!timestamp || Number.isNaN(Number(timestamp))) return "";
  const date = new Date(timestamp);
  const current = new Date(now);

  const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === current.getFullYear() ? undefined : "numeric",
  });
}
