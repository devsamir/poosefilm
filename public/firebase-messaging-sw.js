/* Poosefilm does not use Firebase Cloud Messaging. This no-op worker keeps stale registrations quiet. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
