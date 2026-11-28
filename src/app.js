import { classifyInput, parseVideoId } from "./parse.js";
import { embedUrl, watchUrl, isEmbedError, EMBED_ORIGIN } from "./player.js";
import {
  normalizeQuery,
  searchVideos,
  errorMessage,
  formatRelativeDate,
  nextBatch,
  mergeResults,
  canLoadMore,
  endMessage,
} from "./search.js";
import { sidebarTitle, historyMode } from "./view.js";

const form = document.querySelector("#bar");
const input = document.querySelector("#q");
const hint = document.querySelector("#hint");
const watch = document.querySelector("#watch");
const frame = document.querySelector("#player-frame");
const openLink = document.querySelector("#open-yt");
const playerError = document.querySelector("#player-error");
const sidebarHeading = document.querySelector("#sidebar-title");
const sidebarList = document.querySelector("#sidebar-list");
const sidebarEmpty = document.querySelector("#sidebar-empty");
const resultsSection = document.querySelector("#results");
const resultsList = document.querySelector("#results-list");
const sentinel = document.querySelector("#results-sentinel");
const endNote = document.querySelector("#results-end");
const moreError = document.querySelector("#more-error");
const loadMoreBtn = document.querySelector("#load-more");
const loadMoreLabel = document.querySelector("#load-more-label");

// From 1024px the sidebar sits beside the player; below that it is stacked underneath.
const wide = window.matchMedia("(min-width: 1024px)");

let currentId = null;
let searchToken = 0; // lets us ignore a slow search that finishes after a newer one
let showResults = false; // the results grid may be on screen (it is hidden while a video plays)
let searchScrollY = 0; // where the search view was scrolled to when a video opened

function showHint(message) {
  hint.textContent = message;
  hint.hidden = !message;
}

// Search view: the results grid. Watch view: the player with the sidebar list next to it.
function syncView() {
  const watching = currentId !== null;
  document.body.dataset.view = watching ? "watch" : "search";
  watch.hidden = !watching;
  resultsSection.hidden = watching || !showResults;
}

function play(id, { push = true, source = "bar" } = {}) {
  const previousId = currentId;
  if (previousId === null) searchScrollY = window.scrollY;
  currentId = id;
  playerError.hidden = true;
  showHint("");

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl(id, location.origin);
  iframe.title = "YouTube video player";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.addEventListener("load", () => {
    // Ask the player to report errors (e.g. embedding disabled) back to this page.
    iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), EMBED_ORIGIN);
  });
  frame.replaceChildren(iframe);

  openLink.href = watchUrl(id);

  // Before the view switches: hiding the grid shrinks the page, and the browser
  // saves the scroll position of the entry we are leaving at this moment.
  const mode = push ? historyMode(previousId, id, source) : "none";
  if (mode === "push") history.pushState({ id }, "", `?yt=${id}`);
  else if (mode === "replace") history.replaceState({ id }, "", `?yt=${id}`);

  syncView();
  markPlaying(id, { reveal: true });
}

function stop() {
  const wasWatching = currentId !== null;
  currentId = null;
  frame.replaceChildren();
  playerError.hidden = true;
  markPlaying(null);
  syncView();
  if (wasWatching) window.scrollTo(0, searchScrollY); // back to where the grid was
}

function syncFromUrl() {
  const raw = new URLSearchParams(location.search).get("yt");
  const id = raw ? parseVideoId(raw) : null;
  if (id) play(id, { push: false });
  else stop();
}

// What the results are currently showing. `all` is everything fetched; `shown` is how many grid cards are on screen.
const feed = { query: "", all: [], shown: 0, nextPageToken: null, loadingMore: false };

// Reveals more cards (free, from data already fetched) when the bottom of the grid nears the screen.
const observer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) revealMore();
        },
        { rootMargin: "0px 0px 400px 0px" },
      )
    : null;

function watchSentinel() {
  if (!observer) return;
  observer.unobserve(sentinel); // re-observing makes the browser check again, which keeps filling tall screens
  observer.observe(sentinel);
}

function createCard(item) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";

  const thumb = document.createElement("img");
  thumb.className = "card-thumb";
  thumb.alt = "";
  thumb.loading = "lazy";
  thumb.referrerPolicy = "no-referrer";
  thumb.width = 320;
  thumb.height = 180;
  if (item.thumbnail) thumb.src = item.thumbnail;

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = item.title;

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = [item.channel, formatRelativeDate(item.publishedAt)].filter(Boolean).join(" · ");

  const body = document.createElement("span");
  body.className = "card-body";
  body.append(title, meta);
  card.append(thumb, body);

  card.addEventListener("click", () => {
    play(item.id);
    window.scrollTo(0, 0);
  });

  const li = document.createElement("li");
  li.append(card);
  return li;
}

function appendCards(from, to) {
  const fragment = document.createDocumentFragment();
  for (const item of feed.all.slice(from, to)) fragment.append(createCard(item));
  resultsList.append(fragment);
}

// Sidebar rows, one per loaded result. Built once per list so picking a video only moves the highlight.
const rows = new Map(); // video id -> row button
let playingRow = null;

function createRow(item) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "row";

  const thumb = document.createElement("img");
  thumb.className = "row-thumb";
  thumb.alt = "";
  thumb.loading = "lazy";
  thumb.referrerPolicy = "no-referrer";
  thumb.width = 120;
  thumb.height = 68;
  if (item.thumbnail) thumb.src = item.thumbnail;

  const title = document.createElement("span");
  title.className = "row-title";
  title.textContent = item.title;

  const meta = document.createElement("span");
  meta.className = "row-meta";
  meta.textContent = item.channel;

  const body = document.createElement("span");
  body.className = "row-body";
  body.append(title, meta);
  row.append(thumb, body);

  row.addEventListener("click", () => {
    play(item.id, { source: "sidebar" });
    if (!wide.matches) window.scrollTo(0, 0); // stacked layout: bring the player back into view
  });

  rows.set(item.id, row);
  const li = document.createElement("li");
  li.append(row);
  return li;
}

// Scrolls the list (not the page) just enough to show the row.
function keepInView(row) {
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (top < sidebarList.scrollTop) sidebarList.scrollTop = top;
  else if (bottom > sidebarList.scrollTop + sidebarList.clientHeight) sidebarList.scrollTop = bottom - sidebarList.clientHeight;
}

function markPlaying(id, { reveal = false } = {}) {
  playingRow?.classList.remove("is-playing");
  playingRow?.removeAttribute("aria-current");
  playingRow = id ? (rows.get(id) ?? null) : null;
  if (!playingRow) return;
  playingRow.classList.add("is-playing");
  playingRow.setAttribute("aria-current", "true");
  if (reveal) keepInView(playingRow);
}

// Fills the sidebar from feed.all. `from` is the first result not yet shown there (0 rebuilds the list).
function updateSidebar(from = 0) {
  if (from === 0) {
    sidebarList.replaceChildren();
    rows.clear();
    playingRow = null;
  }
  const fragment = document.createDocumentFragment();
  for (const item of feed.all.slice(from)) fragment.append(createRow(item));
  sidebarList.append(fragment);

  const empty = feed.all.length === 0;
  sidebarHeading.textContent = sidebarTitle(feed.query);
  sidebarHeading.title = sidebarHeading.textContent;
  sidebarHeading.hidden = empty;
  sidebarList.hidden = empty;
  sidebarEmpty.hidden = !empty;
  markPlaying(currentId);
}

function updateFooter() {
  const allShown = feed.shown >= feed.all.length;
  loadMoreBtn.hidden = !(allShown && canLoadMore(feed.all.length, feed.nextPageToken));
  const note = allShown ? endMessage(feed.all.length, feed.nextPageToken) : "";
  endNote.textContent = note;
  endNote.hidden = !note;
}

function revealMore() {
  if (feed.shown < feed.all.length) {
    const from = feed.shown;
    feed.shown = nextBatch(feed.shown, feed.all.length);
    appendCards(from, feed.shown);
  }
  updateFooter();
  if (feed.shown < feed.all.length) watchSentinel();
}

function showFeed(query, page) {
  feed.query = query;
  feed.all = mergeResults([], page.results);
  feed.nextPageToken = page.nextPageToken;
  feed.loadingMore = false;
  feed.shown = 0;
  resultsList.replaceChildren();
  moreError.hidden = true;
  updateSidebar(0);
  showResults = feed.all.length > 0;
  syncView();

  if (feed.all.length === 0) {
    showHint(`Nothing found for “${query}”. Try different words.`);
    return;
  }
  showHint("");
  // Without IntersectionObserver there is no scroll trigger, so show everything we have.
  feed.shown = observer ? nextBatch(0, feed.all.length) : feed.all.length;
  appendCards(0, feed.shown);
  updateFooter();
  if (feed.shown < feed.all.length) watchSentinel();
}

async function runSearch(rawQuery) {
  const query = normalizeQuery(rawQuery);
  const token = ++searchToken;
  showResults = false;
  syncView();
  showHint("Searching…");
  try {
    const page = await searchVideos(query);
    if (token === searchToken) showFeed(query, page);
  } catch (error) {
    if (token === searchToken) showHint(errorMessage(error.code));
  }
}

// Fetches the next page from YouTube. This costs another search, so it only runs when the user presses the button.
async function loadMore() {
  if (feed.loadingMore || !feed.nextPageToken) return;
  feed.loadingMore = true;
  loadMoreBtn.disabled = true;
  loadMoreLabel.textContent = "Loading…";
  moreError.hidden = true;
  const token = searchToken;
  try {
    const page = await searchVideos(feed.query, { pageToken: feed.nextPageToken });
    if (token !== searchToken) return; // a newer search replaced this list
    const before = feed.all.length;
    feed.all = mergeResults(feed.all, page.results);
    updateSidebar(before);
    // A page with nothing new means we have reached the end, so stop offering more.
    feed.nextPageToken = feed.all.length > before ? page.nextPageToken : null;
    revealMore();
  } catch (error) {
    if (token === searchToken) {
      moreError.textContent = errorMessage(error.code);
      moreError.hidden = false;
    }
  } finally {
    feed.loadingMore = false;
    loadMoreBtn.disabled = false;
    loadMoreLabel.textContent = "Load more";
  }
}

loadMoreBtn.addEventListener("click", loadMore);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = classifyInput(input.value);
  if (result.type === "video") {
    searchToken++; // cancel any search still in flight
    play(result.id);
  } else if (result.type === "search") {
    runSearch(result.query);
  }
});

window.addEventListener("popstate", syncFromUrl);

window.addEventListener("message", (event) => {
  const iframe = frame.querySelector("iframe");
  if (event.origin !== EMBED_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
  if (isEmbedError(event.data)) playerError.hidden = false;
});

syncFromUrl();
