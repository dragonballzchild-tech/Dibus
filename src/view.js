// Pure helpers for the watch view. No DOM access.

/** Heading for the sidebar: which search the listed videos came from. */
export function sidebarTitle(query) {
  const text = (query ?? "").trim();
  return text ? `Results for “${text}”` : "Results";
}
