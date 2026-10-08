const CACHE = "promptshare-shell-v97";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop every previously cached document, including the About shell that
    // v65 stored under /shell for whatever page was opened last.
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
    // v72: no client.navigate() here. Awaiting a navigation of a controlled
    // /images or /videos tab inside activate deadlocked it (the navigation
    // waits for this worker to finish activating), freezing the page. With no
    // fetch handler and no caches there is nothing stale to reload.
  })());
});

// No fetch handler. Do not cache navigations and do not fall back to the
// About/home shell for /videos or /images (or any other route).
