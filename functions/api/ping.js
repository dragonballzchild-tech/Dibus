// Temporary deployment check for T2. Removed in T5 when the real search function lands.
export function onRequestGet() {
  return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
