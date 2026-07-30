self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal SW so browsers treat the app as installable (Add to Home Screen).
self.addEventListener("fetch", () => {});
