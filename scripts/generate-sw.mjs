import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const dist = resolve("dist");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const assets = files(dist)
  .filter((path) => !path.endsWith(`${sep}sw.js`))
  .map((path) => ({
    url: "/" + relative(dist, path).split(sep).join("/"),
    hash: createHash("sha256").update(readFileSync(path)).digest("hex"),
  }))
  .sort((a, b) => a.url.localeCompare(b.url));
const version = createHash("sha256")
  .update(JSON.stringify(assets))
  .digest("hex")
  .slice(0, 12);
const paths = assets.map(({ url }) => url);

writeFileSync(
  join(dist, "sw.js"),
  `const CACHE = "financeflow-static-${version}";
const ASSETS = ${JSON.stringify(paths)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("financeflow-static-") && name !== CACHE).map((name) => caches.delete(name)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match("/index.html")));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`,
);
