import { classifyInput, parseVideoId } from "./parse.js";
import { embedUrl, watchUrl, isEmbedError, EMBED_ORIGIN } from "./player.js";
import { normalizeQuery, searchVideos, errorMessage, formatRelativeDate } from "./search.js";

const form = document.querySelector("#bar");
const input = document.querySelector("#q");
const hint = document.querySelector("#hint");
const player = document.querySelector("#player");
const frame = document.querySelector("#player-frame");
const openLink = document.querySelector("#open-yt");
const playerError = document.querySelector("#player-error");
const resultsSection = document.querySelector("#results");
const resultsList = document.querySelector("#results-list");

let currentId = null;
let searchToken = 0; // lets us ignore a slow search that finishes after a newer one

function showHint(message) {
  hint.textContent = message;
  hint.hidden = !message;
}

function play(id, { push = true } = {}) {
  const changed = id !== currentId;
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
  player.hidden = false;
  if (push && changed) history.pushState({ id }, "", `?yt=${id}`);
}

function stop() {
  currentId = null;
  frame.replaceChildren();
  playerError.hidden = true;
  player.hidden = true;
}

function syncFromUrl() {
  const raw = new URLSearchParams(location.search).get("yt");
  const id = raw ? parseVideoId(raw) : null;
  if (id) play(id, { push: false });
  else stop();
}

function renderResults(query, results) {
  resultsList.replaceChildren();
  if (results.length === 0) {
    resultsSection.hidden = true;
    showHint(`Nothing found for “${query}”. Try different words.`);
    return;
  }
  showHint("");
  for (const item of results) {
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
      player.scrollIntoView({ block: "start" });
    });

    const li = document.createElement("li");
    li.append(card);
    resultsList.append(li);
  }
  resultsSection.hidden = false;
}

async function runSearch(rawQuery) {
  const query = normalizeQuery(rawQuery);
  const token = ++searchToken;
  resultsSection.hidden = true;
  showHint("Searching…");
  try {
    const results = await searchVideos(query);
    if (token === searchToken) renderResults(query, results);
  } catch (error) {
    if (token === searchToken) showHint(errorMessage(error.code));
  }
}

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
