// Pure helpers for the watch view. No DOM access.

/** Heading for the sidebar: which search the listed videos came from. */
export function sidebarTitle(query) {
  const text = (query ?? "").trim();
  return text ? `Results for “${text}”` : "Results";
}

/**
 * How playing a video should touch the browser history: "push", "replace" or "none".
 * Picking another video from the sidebar swaps the current entry, so Back returns
 * to the search view instead of stepping through every video watched.
 */
export function historyMode(previousId, nextId, source = "bar") {
  if (previousId === nextId) return "none";
  if (source === "sidebar" && previousId) return "replace";
  return "push";
}
