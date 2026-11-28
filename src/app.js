import { parseVideoId } from "./parse.js";
import {
  DEFAULT_BATCH_SIZE,
  MAX_RESULTS_PER_SEARCH,
  fetchSearchResults,
  mergeUniqueResults,
  revealNextBatch,
} from "./search.js";
import {
  MAX_RECENT_CHIPS,
  STORAGE_KEYS,
  addSearchHistory,
  addWatchedVideo,
  clearHistoryList,
  formatRelativeTime,
  loadLastSearch,
  readList,
  removeHistoryItem,
  saveLastSearch,
} from "./storage.js";

const state = {
  currentVideo: null,
  query: "",
  results: [],
  visibleCount: 0,
  nextPageToken: null,
  hasSearched: false,
  isLoading: false,
  historyTab: "watched",
};

const els = {
  homeLink: document.getElementById("home-link"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  searchClearBtn: document.getElementById("search-clear-btn"),
  searchSubmitBtn: document.getElementById("search-submit-btn"),
  statusBanner: document.getElementById("status-banner"),
  chipsArea: document.getElementById("chips-area"),
  recentSearchesGroup: document.getElementById("recent-searches-group"),
  recentSearchesList: document.getElementById("recent-searches-list"),
  clearRecentSearchesBtn: document.getElementById("clear-recent-searches"),
  recentWatchedGroup: document.getElementById("recent-watched-group"),
  recentWatchedList: document.getElementById("recent-watched-list"),
  clearRecentWatchedBtn: document.getElementById("clear-recent-watched"),
  watchView: document.getElementById("watch-view"),
  playerAspect: document.getElementById("player-aspect"),
  playerIframe: document.getElementById("player-iframe"),
  embedError: document.getElementById("embed-error"),
  embedErrorYtLink: document.getElementById("embed-error-yt-link"),
  watchTitle: document.getElementById("watch-title"),
  watchChannel: document.getElementById("watch-channel"),
  openYoutubeLink: document.getElementById("open-youtube-link"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  copyLinkLabel: document.getElementById("copy-link-label"),
  cantEmbedBtn: document.getElementById("cant-embed-btn"),
  sidebarHeading: document.getElementById("sidebar-heading"),
  sidebarList: document.getElementById("sidebar-list"),
  sidebarEmpty: document.getElementById("sidebar-empty"),
  resultsView: document.getElementById("results-view"),
  resultsHeading: document.getElementById("results-heading"),
  resultsCount: document.getElementById("results-count"),
  resultsGrid: document.getElementById("results-grid"),
  scrollSentinel: document.getElementById("scroll-sentinel"),
  resultsFooter: document.getElementById("results-footer"),
  loadMoreBtn: document.getElementById("load-more-btn"),
  loadMoreError: document.getElementById("load-more-error"),
  resultsEndMsg: document.getElementById("results-end-msg"),
  historyOpenBtn: document.getElementById("history-open-btn"),
  historyCloseBtn: document.getElementById("history-close-btn"),
  historyDrawer: document.getElementById("history-drawer"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  tabWatched: document.getElementById("tab-watched"),
  tabSearches: document.getElementById("tab-searches"),
  historyList: document.getElementById("history-list"),
  historyClearAllBtn: document.getElementById("history-clear-all-btn"),
  historyConfirmWrap: document.getElementById("history-confirm-wrap"),
  historyConfirmYes: document.getElementById("history-confirm-yes"),
  historyConfirmNo: document.getElementById("history-confirm-no"),
};

function setStatus(message = "") {
  if (!message) {
    els.statusBanner.hidden = true;
    els.statusBanner.textContent = "";
    return;
  }
  els.statusBanner.textContent = message;
  els.statusBanner.hidden = false;
}

function updateClearButton() {
  els.searchClearBtn.hidden = els.searchInput.value.length === 0;
}

function formatPublishedDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildShareUrl(videoId, query) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("yt", videoId);
  if (query) {
    url.searchParams.set("q", query);
  }
  return url.toString();
}

function syncBrowserUrl(videoId, query, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("yt");
  url.searchParams.delete("q");
  if (videoId) {
    url.searchParams.set("yt", videoId);
  }
  if (query) {
    url.searchParams.set("q", query);
  }
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ videoId, query }, "", url.toString());
}

function renderChips() {
  const searches = readList(STORAGE_KEYS.searches).slice(0, MAX_RECENT_CHIPS);
  const watched = readList(STORAGE_KEYS.watched).slice(0, MAX_RECENT_CHIPS);

  els.recentSearchesList.replaceChildren();
  for (const item of searches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = item.query;
    btn.title = item.query;
    btn.addEventListener("click", () => {
      els.searchInput.value = item.query;
      updateClearButton();
      runSearch(item.query);
    });
    els.recentSearchesList.appendChild(btn);
  }
  els.recentSearchesGroup.hidden = searches.length === 0;

  els.recentWatchedList.replaceChildren();
  for (const item of watched) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = item.title || item.id;
    btn.title = item.title || item.id;
    btn.addEventListener("click", () => {
      playVideo(item);
    });
    els.recentWatchedList.appendChild(btn);
  }
  els.recentWatchedGroup.hidden = watched.length === 0;

  els.chipsArea.hidden = Boolean(state.currentVideo) || (searches.length === 0 && watched.length === 0);
}

function createResultCard(item) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "video-card";

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "card-thumb-wrap";

  const img = document.createElement("img");
  img.className = "card-thumb";
  img.loading = "lazy";
  img.alt = item.title;
  img.src = item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
  thumbWrap.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = item.title;

  const meta = document.createElement("p");
  meta.className = "card-meta";
  const dateStr = formatPublishedDate(item.publishedAt);
  meta.textContent = dateStr ? `${item.channelTitle} · ${dateStr}` : item.channelTitle;

  body.append(title, meta);
  card.append(thumbWrap, body);

  card.addEventListener("click", () => {
    playVideo(item);
  });

  return card;
}

function renderResultsGrid() {
  const visibleItems = state.results.slice(0, state.visibleCount);
  els.resultsGrid.replaceChildren();
  for (const item of visibleItems) {
    els.resultsGrid.appendChild(createResultCard(item));
  }

  els.resultsHeading.textContent = state.query
    ? `RESULTS FOR "${state.query.toUpperCase()}"`
    : "RESULTS";
  els.resultsCount.textContent = state.results.length
    ? `Showing ${visibleItems.length} of ${state.results.length}`
    : "";

  const allLoadedShown = state.visibleCount >= state.results.length;
  const reachedCap = state.results.length >= MAX_RESULTS_PER_SEARCH;
  const canLoadMore = allLoadedShown && Boolean(state.nextPageToken) && !reachedCap;

  els.loadMoreBtn.hidden = !canLoadMore;
  els.loadMoreError.hidden = true;
  els.loadMoreError.textContent = "";

  if (state.results.length === 0) {
    els.resultsFooter.hidden = true;
  } else if (allLoadedShown && reachedCap) {
    els.resultsFooter.hidden = false;
    els.resultsEndMsg.textContent = "That's all for now. Try a more specific search.";
    els.resultsEndMsg.hidden = false;
  } else if (allLoadedShown && !state.nextPageToken) {
    els.resultsFooter.hidden = false;
    els.resultsEndMsg.textContent = "End of results";
    els.resultsEndMsg.hidden = false;
  } else {
    els.resultsFooter.hidden = !canLoadMore;
    els.resultsEndMsg.hidden = true;
  }

  els.resultsView.hidden = Boolean(state.currentVideo) || !state.hasSearched;
}

function renderSidebar() {
  const prevScroll = els.sidebarList.scrollTop;
  els.sidebarList.replaceChildren();

  els.sidebarHeading.textContent = state.query
    ? `RESULTS FOR "${state.query.toUpperCase()}"`
    : "RESULTS";

  if (state.results.length === 0) {
    els.sidebarEmpty.hidden = false;
    return;
  }

  els.sidebarEmpty.hidden = true;
  for (const item of state.results) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "sidebar-row";
    if (state.currentVideo?.id === item.id) {
      row.classList.add("is-playing");
      row.setAttribute("aria-current", "true");
    }

    const img = document.createElement("img");
    img.className = "sidebar-thumb";
    img.loading = "lazy";
    img.alt = item.title;
    img.src = item.thumbnail || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;

    const body = document.createElement("div");
    body.className = "sidebar-row-body";

    const title = document.createElement("p");
    title.className = "sidebar-row-title";
    title.textContent = item.title;

    const channel = document.createElement("p");
    channel.className = "sidebar-row-channel";
    channel.textContent = item.channelTitle;

    body.append(title, channel);
    row.append(img, body);

    row.addEventListener("click", () => {
      playVideo(item);
    });

    els.sidebarList.appendChild(row);
  }

  els.sidebarList.scrollTop = prevScroll;
}

function showEmbedError(videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  els.embedErrorYtLink.href = ytUrl;
  els.playerAspect.hidden = true;
  els.embedError.hidden = false;
}

function playVideo(video, { updateUrl = true, replaceUrl = false } = {}) {
  const id = typeof video === "string" ? video : video?.id;
  if (!id) return;

  const matched = state.results.find((item) => item.id === id);
  const resolved = {
    id,
    title: (typeof video === "object" && video.title) || matched?.title || `Video ${id}`,
    channelTitle: (typeof video === "object" && video.channelTitle) || matched?.channelTitle || "",
    thumbnail:
      (typeof video === "object" && video.thumbnail) ||
      matched?.thumbnail ||
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };

  state.currentVideo = resolved;
  setStatus("");

  els.playerAspect.hidden = false;
  els.embedError.hidden = true;
  els.playerIframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&autoplay=1`;
  els.watchTitle.textContent = resolved.title;
  els.watchChannel.textContent = resolved.channelTitle;
  els.watchChannel.hidden = !resolved.channelTitle;

  const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  els.openYoutubeLink.href = ytUrl;
  els.embedErrorYtLink.href = ytUrl;
  els.copyLinkLabel.textContent = "Copy link";

  els.watchView.hidden = false;
  els.resultsView.hidden = true;
  els.chipsArea.hidden = true;

  addWatchedVideo(resolved);
  renderSidebar();
  renderChips();

  if (updateUrl) {
    syncBrowserUrl(id, state.query, replaceUrl);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSearchHome({ updateUrl = true } = {}) {
  state.currentVideo = null;
  els.playerIframe.src = "";
  els.watchView.hidden = true;
  renderResultsGrid();
  renderChips();
  if (updateUrl) {
    syncBrowserUrl(null, state.query || null);
  }
}

async function runSearch(rawQuery, { keepWatchView = false, updateUrl = true } = {}) {
  const query = (rawQuery ?? "").trim();
  if (!query) return;

  if (query.length > 100) {
    setStatus("Please keep your search under 100 characters.");
    return;
  }

  state.isLoading = true;
  els.searchSubmitBtn.disabled = true;
  setStatus("Searching YouTube…");

  try {
    const data = await fetchSearchResults(query);
    state.query = query;
    state.results = data.items;
    state.nextPageToken = data.nextPageToken;
    state.hasSearched = true;

    const supportsObserver = typeof globalThis.IntersectionObserver === "function";
    state.visibleCount = supportsObserver
      ? Math.min(data.items.length, DEFAULT_BATCH_SIZE)
      : data.items.length;

    addSearchHistory(query);
    saveLastSearch({
      query,
      items: data.items,
      nextPageToken: data.nextPageToken,
    });

    if (data.items.length === 0) {
      setStatus(`Nothing found for "${query}".`);
    } else {
      setStatus("");
    }

    if (!keepWatchView) {
      state.currentVideo = null;
      els.playerIframe.src = "";
      els.watchView.hidden = true;
      if (updateUrl) {
        syncBrowserUrl(null, query);
      }
    }

    renderResultsGrid();
    renderSidebar();
    renderChips();
  } catch (err) {
    if (err.code === "QUOTA_EXCEEDED") {
      setStatus("Search limit reached for today, paste a link instead");
    } else {
      setStatus(err.message || "Search failed. Please try again.");
    }
  } finally {
    state.isLoading = false;
    els.searchSubmitBtn.disabled = false;
  }
}

async function loadMoreResults() {
  if (state.isLoading || !state.nextPageToken || state.results.length >= MAX_RESULTS_PER_SEARCH) {
    return;
  }

  state.isLoading = true;
  els.loadMoreBtn.disabled = true;
  els.loadMoreError.hidden = true;

  try {
    const data = await fetchSearchResults(state.query, state.nextPageToken);
    const merged = mergeUniqueResults(state.results, data.items).slice(0, MAX_RESULTS_PER_SEARCH);
    state.results = merged;
    state.nextPageToken = merged.length >= MAX_RESULTS_PER_SEARCH ? null : data.nextPageToken;

    const supportsObserver = typeof globalThis.IntersectionObserver === "function";
    state.visibleCount = supportsObserver
      ? revealNextBatch(state.results, state.visibleCount, DEFAULT_BATCH_SIZE)
      : state.results.length;

    saveLastSearch({
      query: state.query,
      items: state.results,
      nextPageToken: state.nextPageToken,
    });

    renderResultsGrid();
    renderSidebar();
  } catch (err) {
    els.loadMoreError.textContent =
      err.code === "QUOTA_EXCEEDED"
        ? "Search limit reached for today, paste a link instead"
        : err.message || "Could not load more results. Try again.";
    els.loadMoreError.hidden = false;
  } finally {
    state.isLoading = false;
    els.loadMoreBtn.disabled = false;
  }
}

function renderHistoryDrawer() {
  const isWatched = state.historyTab === "watched";
  els.tabWatched.classList.toggle("is-active", isWatched);
  els.tabWatched.setAttribute("aria-selected", String(isWatched));
  els.tabSearches.classList.toggle("is-active", !isWatched);
  els.tabSearches.setAttribute("aria-selected", String(!isWatched));

  const key = isWatched ? STORAGE_KEYS.watched : STORAGE_KEYS.searches;
  const keyField = isWatched ? "id" : "query";
  const items = readList(key);

  els.historyList.replaceChildren();
  els.historyConfirmWrap.hidden = true;
  els.historyClearAllBtn.hidden = items.length === 0;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = isWatched ? "No watched videos yet." : "No searches yet.";
    els.historyList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "history-item";

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "history-item-btn";

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = isWatched ? item.title || item.id : item.query;

    const time = document.createElement("span");
    time.className = "history-item-time";
    time.textContent = formatRelativeTime(item.timestamp);

    selectBtn.append(title, time);
    selectBtn.addEventListener("click", () => {
      closeHistoryDrawer();
      if (isWatched) {
        playVideo(item);
      } else {
        els.searchInput.value = item.query;
        updateClearButton();
        runSearch(item.query);
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "history-remove-btn";
    removeBtn.setAttribute("aria-label", `Remove ${isWatched ? item.title : item.query}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      removeHistoryItem(key, keyField, item[keyField]);
      renderHistoryDrawer();
      renderChips();
    });

    row.append(selectBtn, removeBtn);
    els.historyList.appendChild(row);
  }
}

function openHistoryDrawer() {
  renderHistoryDrawer();
  els.drawerBackdrop.hidden = false;
  els.historyDrawer.hidden = false;
  els.historyOpenBtn.setAttribute("aria-expanded", "true");
  els.historyCloseBtn.focus();
}

function closeHistoryDrawer() {
  els.drawerBackdrop.hidden = true;
  els.historyDrawer.hidden = true;
  els.historyOpenBtn.setAttribute("aria-expanded", "false");
  els.historyConfirmWrap.hidden = true;
}

function setupScrollReveal() {
  if (typeof globalThis.IntersectionObserver !== "function") return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (state.visibleCount < state.results.length) {
          state.visibleCount = revealNextBatch(state.results, state.visibleCount, DEFAULT_BATCH_SIZE);
          renderResultsGrid();
        }
      }
    },
    { rootMargin: "280px" }
  );

  observer.observe(els.scrollSentinel);
}

function bindEvents() {
  els.homeLink.addEventListener("click", (event) => {
    event.preventDefault();
    showSearchHome();
  });

  els.searchInput.addEventListener("input", updateClearButton);

  els.searchClearBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    updateClearButton();
    els.searchInput.focus();
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = els.searchInput.value.trim();
    if (!raw) return;

    const videoId = parseVideoId(raw);
    if (videoId) {
      playVideo({ id: videoId });
      return;
    }

    runSearch(raw);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.historyDrawer.hidden) {
      closeHistoryDrawer();
      return;
    }
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) {
      return;
    }
    event.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
  });

  els.clearRecentSearchesBtn.addEventListener("click", () => {
    clearHistoryList(STORAGE_KEYS.searches);
    renderChips();
  });

  els.clearRecentWatchedBtn.addEventListener("click", () => {
    clearHistoryList(STORAGE_KEYS.watched);
    renderChips();
  });

  els.loadMoreBtn.addEventListener("click", loadMoreResults);

  els.copyLinkBtn.addEventListener("click", async () => {
    if (!state.currentVideo) return;
    const shareUrl = buildShareUrl(state.currentVideo.id, state.query);
    try {
      await navigator.clipboard.writeText(shareUrl);
      els.copyLinkLabel.textContent = "Copied";
    } catch {
      els.copyLinkLabel.textContent = "Copy failed";
    }
    window.setTimeout(() => {
      els.copyLinkLabel.textContent = "Copy link";
    }, 2000);
  });

  els.cantEmbedBtn.addEventListener("click", () => {
    if (!state.currentVideo) return;
    showEmbedError(state.currentVideo.id);
  });

  els.historyOpenBtn.addEventListener("click", openHistoryDrawer);
  els.historyCloseBtn.addEventListener("click", closeHistoryDrawer);
  els.drawerBackdrop.addEventListener("click", closeHistoryDrawer);

  els.tabWatched.addEventListener("click", () => {
    state.historyTab = "watched";
    renderHistoryDrawer();
  });

  els.tabSearches.addEventListener("click", () => {
    state.historyTab = "searches";
    renderHistoryDrawer();
  });

  els.historyClearAllBtn.addEventListener("click", () => {
    els.historyClearAllBtn.hidden = true;
    els.historyConfirmWrap.hidden = false;
  });

  els.historyConfirmNo.addEventListener("click", () => {
    els.historyConfirmWrap.hidden = true;
    els.historyClearAllBtn.hidden = false;
  });

  els.historyConfirmYes.addEventListener("click", () => {
    const key = state.historyTab === "watched" ? STORAGE_KEYS.watched : STORAGE_KEYS.searches;
    clearHistoryList(key);
    renderHistoryDrawer();
    renderChips();
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const ytParam = params.get("yt");
    const videoId = parseVideoId(ytParam);
    if (videoId) {
      playVideo({ id: videoId }, { updateUrl: false });
    } else {
      showSearchHome({ updateUrl: false });
    }
  });
}

async function init() {
  bindEvents();
  setupScrollReveal();
  updateClearButton();

  const saved = loadLastSearch();
  if (saved) {
    state.query = saved.query;
    state.results = saved.items;
    state.nextPageToken = saved.nextPageToken ?? null;
    state.hasSearched = true;
    state.visibleCount = Math.min(saved.items.length, DEFAULT_BATCH_SIZE);
  }

  renderChips();

  const params = new URLSearchParams(window.location.search);
  const ytParam = params.get("yt");
  const qParam = (params.get("q") ?? "").trim();
  const initialVideoId = parseVideoId(ytParam);

  if (qParam) {
    els.searchInput.value = qParam;
    updateClearButton();
  }

  if (initialVideoId) {
    playVideo({ id: initialVideoId }, { updateUrl: true, replaceUrl: true });
    if (qParam && qParam !== state.query) {
      await runSearch(qParam, { keepWatchView: true, updateUrl: false });
    }
    return;
  }

  if (qParam) {
    await runSearch(qParam, { updateUrl: false });
    return;
  }

  if (state.hasSearched) {
    renderResultsGrid();
  }
}

init();
