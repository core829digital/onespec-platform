/*
 * OneSpec service worker — deliberately minimal.
 *
 * Its only job is to make the app installable on every Chromium browser (Chrome, Edge, Samsung Internet, Opera): they only offer
 * "install" when a service worker with a fetch handler controls the page. It does NOT cache and does NOT answer requests (the handler
 * never calls respondWith), so every request goes to the network exactly as without it: quotes, prices and live data are never stale.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* network passthrough */
});
