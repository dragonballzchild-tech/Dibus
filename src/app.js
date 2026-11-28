import { parseVideoId } from "./parse.js";
import { searchVideos } from "./search.js";
import {
  addSearch, addWatched, clearHistory, clearRecent, formatRelativeTime,
  getLastResults, getSearchHistory, getWatchHistory, removeSearch, removeWatched,
  saveLastResults,
} from "./storage.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $("#search-form"), input: $("#search-input"), clear: $("#clear-search"),
  recent: $("#recent-section"), recentSearches: $("#recent-searches"), recentWatched: $("#recent-watched"),
  recentSearchGroup: $("#recent-search-group"), recentWatchGroup: $("#recent-watch-group"), clearRecent: $("#clear-recent"),
  resultsSection: $("#results-section"), resultsHeading: $("#results-heading"), resultCount: $("#result-count"),
  status: $("#status-message"), grid: $("#results-grid"), watch: $("#watch-layout"),
  iframe: $("#youtube-player"), placeholder: $("#player-placeholder"), playerError: $("#player-error"),
  errorLink: $("#error-youtube-link"), openYouTube: $("#open-youtube"), copy: $("#copy-link"), copyFeedback: $("#copy-feedback"),
  videoMeta: $("#video-meta"), videoTitle: $("#video-title"), videoChannel: $("#video-channel"),
  sidebarTitle: $("#sidebar-title"), sidebarList: $("#sidebar-list"),
  historyOpen: $("#history-open"), historyClose: $("#history-close"), historyPanel: $("#history-panel"),
  historyBackdrop: $("#history-backdrop"), historyItems: $("#history-items"), clearHistory: $("#clear-history"),
  tabs: [...document.querySelectorAll(".history-tab")], toast: $("#toast"),
};

let state = { query: "", results: [], currentVideo: null, historyTab: "watched", lastFocused: null, toastTimer: null, searchRequestId: 0 };

function setStatus(message, kind = "info") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
  elements.status.hidden = false;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function formatPublished(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(date);
}

function thumbnailFor(video) {
  return video.thumbnails?.high || video.thumbnails?.medium || video.thumbnails?.default || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

function makeCard(video, index) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Play ${video.title}`);
  card.style.animationDelay = `${Math.min(index * 35, 350)}ms`;

  const thumbnail = document.createElement("div");
  thumbnail.className = "thumbnail";
  const image = document.createElement("img");
  image.src = thumbnailFor(video);
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  thumbnail.append(image);

  const title = document.createElement("h3");
  title.textContent = video.title;
  const channel = document.createElement("p");
  channel.className = "channel";
  channel.textContent = video.channel;
  const published = document.createElement("p");
  published.className = "published";
  published.textContent = formatPublished(video.publishedAt);
  card.append(thumbnail, title, channel, published);
  card.addEventListener("click", () => playVideo(video));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playVideo(video); }
  });
  return card;
}

function renderResults() {
  elements.grid.replaceChildren();
  elements.grid.hidden = state.results.length === 0;
  elements.resultsHeading.hidden = state.results.length === 0;
  elements.resultCount.textContent = `${state.results.length} VIDEOS`;
  state.results.forEach((video, index) => elements.grid.append(makeCard(video, index)));
}

function renderSidebar() {
  const previousScrollTop = elements.sidebarList.scrollTop;
  elements.sidebarList.replaceChildren();
  if (!state.results.length) {
    elements.sidebarTitle.textContent = "SEARCH TO FILL THIS LIST";
    const empty = document.createElement("p");
    empty.className = "sidebar-empty";
    empty.textContent = "Search to fill this list.";
    elements.sidebarList.append(empty);
    elements.sidebarList.scrollTop = previousScrollTop;
    return;
  }
  elements.sidebarTitle.textContent = state.query ? `RESULTS FOR “${state.query}”` : "YOUR RECENT RESULTS";
  state.results.forEach((video) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `sidebar-row${state.currentVideo?.id === video.id ? " active" : ""}`;
    row.setAttribute("aria-current", state.currentVideo?.id === video.id ? "true" : "false");
    const image = document.createElement("img");
    image.className = "sidebar-thumb";
    image.src = thumbnailFor(video);
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    const copy = document.createElement("span");
    copy.className = "sidebar-copy";
    const title = document.createElement("strong");
    title.textContent = video.title;
    const channel = document.createElement("span");
    channel.textContent = video.channel;
    copy.append(title, channel);
    row.append(image, copy);
    row.addEventListener("click", () => playVideo(video));
    elements.sidebarList.append(row);
  });
  elements.sidebarList.scrollTop = previousScrollTop;
}

function renderRecent() {
  const searches = getSearchHistory().slice(0, 8);
  const watched = getWatchHistory().slice(0, 8);
  elements.recentSearches.replaceChildren();
  elements.recentWatched.replaceChildren();
  elements.recentSearchGroup.hidden = searches.length === 0;
  elements.recentWatchGroup.hidden = watched.length === 0;
  elements.recent.hidden = searches.length + watched.length === 0;

  searches.forEach((item) => {
    const button = document.createElement("button");
    button.className = "recent-chip";
    button.type = "button";
    button.textContent = item.query;
    button.title = `Search: ${item.query}`;
    button.addEventListener("click", () => runSearch(item.query));
    elements.recentSearches.append(button);
  });
  watched.forEach((item) => {
    const button = document.createElement("button");
    button.className = "recent-chip";
    button.type = "button";
    button.textContent = item.title;
    button.title = `Play: ${item.title}`;
    button.addEventListener("click", () => playVideo(item));
    elements.recentWatched.append(button);
  });
}

function showWatchView() {
  elements.watch.hidden = false;
  elements.resultsSection.hidden = true;
  elements.recent.hidden = true;
}

function updateUrl(videoId, query = state.query) {
  const params = new URLSearchParams();
  params.set("yt", videoId);
  if (query) params.set("q", query);
  history.replaceState({}, "", `/?${params.toString()}`);
}

function playVideo(video) {
  if (!video?.id || !/^[A-Za-z0-9_-]{11}$/.test(video.id)) return;
  state.currentVideo = video;
  showWatchView();
  elements.placeholder.hidden = false;
  elements.playerError.hidden = true;
  elements.iframe.hidden = true;
  elements.iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0`;
  elements.openYouTube.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
  elements.errorLink.href = elements.openYouTube.href;
  elements.videoTitle.textContent = video.title || "YouTube video";
  elements.videoChannel.textContent = video.channel || "";
  elements.videoMeta.hidden = !video.title;
  elements.iframe.onload = () => {
    elements.placeholder.hidden = true;
    elements.iframe.hidden = false;
  };
  elements.iframe.onerror = () => showEmbedError();
  updateUrl(video.id);
  addWatched(video);
  renderSidebar();
  renderRecent();
}

function showEmbedError() {
  elements.placeholder.hidden = true;
  elements.iframe.hidden = true;
  elements.playerError.hidden = false;
}

async function runSearch(rawQuery) {
  const query = rawQuery.trim();
  if (!query) return;
  const videoId = parseVideoId(query);
  if (videoId) {
    state.searchRequestId += 1;
    state.query = "";
    const saved = getWatchHistory().find((item) => item.id === videoId);
    playVideo(saved || { id: videoId, title: "YouTube video", channel: "" });
    return;
  }
  if (query.length > 100) {
    setStatus("Search queries must be 100 characters or fewer.", "error");
    return;
  }

  const requestId = ++state.searchRequestId;
  state.query = query;
  elements.input.value = query;
  syncClearButton();
  state.results = [];
  elements.grid.replaceChildren();
  elements.resultsHeading.hidden = true;
  setStatus("Searching YouTube…");
  elements.watch.hidden = true;
  elements.resultsSection.hidden = false;
  addSearch(query);
  renderRecent();

  try {
    const results = await searchVideos(query);
    if (requestId !== state.searchRequestId) return;
    state.results = results;
    saveLastResults(query, results);
    if (!results.length) setStatus("Nothing found. Try another search.");
    else elements.status.hidden = true;
    renderResults();
    renderSidebar();
  } catch (error) {
    if (requestId !== state.searchRequestId) return;
    state.results = [];
    renderResults();
    setStatus(error.message || "Search failed. Please try again.", "error");
  }
}

function syncClearButton() { elements.clear.hidden = !elements.input.value; }

function openHistory() {
  state.lastFocused = document.activeElement;
  elements.historyPanel.hidden = false;
  elements.historyBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  renderHistory();
  elements.historyClose.focus();
}

function closeHistory() {
  elements.historyPanel.hidden = true;
  elements.historyBackdrop.hidden = true;
  document.body.style.overflow = "";
  state.lastFocused?.focus?.();
}

function renderHistory() {
  const watched = state.historyTab === "watched";
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.tab === state.historyTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  elements.historyItems.setAttribute("aria-labelledby", watched ? "tab-watched" : "tab-searches");
  const items = watched ? getWatchHistory() : getSearchHistory();
  elements.historyItems.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = watched ? "Videos you watch will appear here." : "Searches you make will appear here.";
    elements.historyItems.append(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const main = document.createElement("button");
    main.type = "button";
    main.className = "history-item-main";
    const title = document.createElement("strong");
    title.textContent = watched ? item.title : item.query;
    const time = document.createElement("span");
    time.textContent = `${watched ? item.channel : "Search"} · ${formatRelativeTime(item.timestamp)}`;
    main.append(title, time);
    main.addEventListener("click", () => {
      closeHistory();
      if (watched) playVideo(item);
      else runSearch(item.query);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-history";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${watched ? item.title : item.query}`);
    remove.addEventListener("click", () => {
      if (watched) removeWatched(item.id);
      else removeSearch(item.query);
      renderHistory();
      renderRecent();
    });
    row.append(main, remove);
    elements.historyItems.append(row);
  });
}

function handleClearHistory() {
  if (!getWatchHistory().length && !getSearchHistory().length) return;
  if (!window.confirm("Clear all watched videos and searches? This cannot be undone.")) return;
  clearHistory();
  renderHistory();
  renderRecent();
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";
  const rawVideo = params.get("yt") || "";
  const id = parseVideoId(rawVideo);
  let hasCachedResults = false;
  if (query && query.length <= 100) {
    state.query = query;
    elements.input.value = query;
    syncClearButton();
    const cached = getLastResults();
    if (cached?.query === query) {
      state.results = cached.results;
      hasCachedResults = true;
      renderResults();
      renderSidebar();
      elements.status.hidden = true;
    }
  }
  if (id) {
    const cachedVideo = state.results.find((item) => item.id === id) || getWatchHistory().find((item) => item.id === id);
    playVideo(cachedVideo || { id, title: "YouTube video", channel: "" });
    if (query && query.length <= 100 && !hasCachedResults) {
      addSearch(query);
      const requestId = ++state.searchRequestId;
      searchVideos(query).then((results) => {
        if (requestId !== state.searchRequestId) return;
        state.results = results;
        saveLastResults(query, results);
        renderSidebar();
        renderRecent();
      }).catch((error) => {
        if (requestId !== state.searchRequestId) return;
        if (error.code === "QUOTA_EXCEEDED") showToast("Search limit reached for today. Video playback still works.");
        // The shared video link remains playable even if its optional result queue cannot load.
      });
    }
  } else if (query && query.length <= 100) {
    runSearch(query);
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(elements.input.value);
});
elements.input.addEventListener("input", syncClearButton);
elements.clear.addEventListener("click", () => {
  elements.input.value = "";
  syncClearButton();
  elements.input.focus();
});
elements.clearRecent.addEventListener("click", () => {
  clearRecent();
  renderRecent();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    event.preventDefault();
    elements.input.focus();
  }
  if (event.key === "Escape" && !elements.historyPanel.hidden) closeHistory();
});
elements.historyOpen.addEventListener("click", openHistory);
elements.historyClose.addEventListener("click", closeHistory);
elements.historyBackdrop.addEventListener("click", closeHistory);
elements.tabs.forEach((tab) => tab.addEventListener("click", () => { state.historyTab = tab.dataset.tab; renderHistory(); }));
elements.clearHistory.addEventListener("click", handleClearHistory);
elements.copy.addEventListener("click", async () => {
  if (!state.currentVideo) return;
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("yt", state.currentVideo.id);
  if (state.query) url.searchParams.set("q", state.query);
  try {
    await navigator.clipboard.writeText(url.toString());
    elements.copyFeedback.textContent = "LINK COPIED";
    showToast("Share link copied");
  } catch {
    showToast("Clipboard access unavailable in this browser");
  }
});
elements.iframe.addEventListener("load", () => {
  if (state.currentVideo) {
    elements.placeholder.hidden = true;
    elements.iframe.hidden = false;
  }
});

const lastResults = getLastResults();
if (lastResults?.results?.length) {
  state.query = lastResults.query || "";
  state.results = lastResults.results;
  renderResults();
}
renderRecent();
renderSidebar();
hydrateFromUrl();
