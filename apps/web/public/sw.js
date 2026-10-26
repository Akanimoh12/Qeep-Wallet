// Minimal service worker so Qeep can be installed as an app.
// It does not cache wallet data; balances always come live from Mezo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
