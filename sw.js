// Bump this to push an update to installed copies.
const VERSION = "v2";
const SHELL = "shell-" + VERSION;
const DATA = "patches-" + VERSION;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

// The patch manifest and lazily-fetched .syx files live in a separate cache
// that survives shell updates until VERSION changes.
const DATA_FILES = ["./assets/DX/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // Individually, so one missing file can't fail the whole install.
    await Promise.all(SHELL_FILES.map(f => c.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, DATA]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isData = /\/assets\/DX\/(manifest\.json|SYX\/.+\.syx)$/i.test(url.pathname);

  // Navigations: network first so a redeploy shows up, cache as the fallback.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(SHELL);
        c.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache first — this is what makes it work with no signal.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        const c = await caches.open(isData ? DATA : SHELL);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});

// Lets the page ask for the manifest to be cached up front. Individual .syx
// files are cached the first time they're fetched by the send path.
self.addEventListener("message", e => {
  if (e.data === "cache-manifest") {
    e.waitUntil((async () => {
      const c = await caches.open(DATA);
      await Promise.all(DATA_FILES.map(f => c.add(f).catch(() => {})));
    })());
  }
});
