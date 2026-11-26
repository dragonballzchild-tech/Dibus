import { classifyInput, parseVideoId } from "./parse.js";
import { embedUrl, watchUrl, isEmbedError, EMBED_ORIGIN } from "./player.js";

const form = document.querySelector("#bar");
const input = document.querySelector("#q");
const hint = document.querySelector("#hint");
const player = document.querySelector("#player");
const frame = document.querySelector("#player-frame");
const openLink = document.querySelector("#open-yt");
const playerError = document.querySelector("#player-error");

let currentId = null;

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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = classifyInput(input.value);
  if (result.type === "video") play(result.id);
  else if (result.type === "search") showHint("Search is coming soon. For now, paste a YouTube link or video ID.");
});

window.addEventListener("popstate", syncFromUrl);

window.addEventListener("message", (event) => {
  const iframe = frame.querySelector("iframe");
  if (event.origin !== EMBED_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
  if (isEmbedError(event.data)) playerError.hidden = false;
});

syncFromUrl();
