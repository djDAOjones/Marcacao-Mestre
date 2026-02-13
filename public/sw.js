/**
 * Service Worker for Marcação Mestre PWA.
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS, icons): Cache-first, network fallback
 *   - Archive.zip: Network-only (too large to cache in SW; managed by app)
 *   - Navigation requests: Network-first, cache fallback (for offline)
 *   - Other assets: Stale-while-revalidate
 *
 * Cache is versioned — bump CACHE_VERSION on each deploy to bust stale assets.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `marcacao-mestre-${CACHE_VERSION}`;

/** Paths to pre-cache on install (app shell) */
const APP_SHELL = [
  '/Marcacao-Mestre/',
  '/Marcacao-Mestre/index.html',
  '/Marcacao-Mestre/icons/icon.svg',
  '/Marcacao-Mestre/manifest.json',
];

/** Patterns to never cache (large files, API calls) */
const NEVER_CACHE = [
  /Archive\.zip$/,
  /\.zip$/,
];

// =============================================================================
// Install — pre-cache app shell
// =============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// =============================================================================
// Activate — purge old caches
// =============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('marcacao-mestre-') && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// =============================================================================
// Fetch — routing strategy
// =============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache large files (Archive.zip)
  if (NEVER_CACHE.some(pattern => pattern.test(url.pathname))) return;

  // Navigation requests: network-first, cache fallback (offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a copy of the navigation response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/Marcacao-Mestre/')))
    );
    return;
  }

  // All other assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          // Only cache valid responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // Network failed, fall back to cache

      // Return cached immediately if available, otherwise wait for network
      return cached || fetchPromise;
    })
  );
});
