const CACHE_PREFIX = "app-big-";
const CACHE_NAME = CACHE_PREFIX + "v3";
const LEGACY_CACHE_NAME = CACHE_PREFIX + "v2";
const OFFLINE_FALLBACK_URL = "/pwa-offline";
const MANIFEST_URL = "/manifest.webmanifest";
// The fallback can be served on any public navigation. Keep this equal to the CETEC baseline.
const OFFLINE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://onesignal.com https://*.onesignal.com wss://onesignal.com wss://*.onesignal.com https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self' data: blob:",
].join("; ");

let fallbackRefresh;

function isPrivatePath(pathname) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function hasCredentialsHeader(request) {
  return request.headers.has("authorization") || request.headers.has("cookie");
}

function isNavigationRequest(request) {
  return (
    (request.mode === "navigate" || request.destination === "document") &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    !request.headers.has("next-router-segment-prefetch")
  );
}

function isStaticAssetRequest(url) {
  return url.pathname === MANIFEST_URL || url.pathname.startsWith("/_next/static/");
}

function isSafeToCache(response) {
  if (!response.ok || response.redirected) {
    return false;
  }

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() || "";
  const vary = response.headers.get("vary")?.toLowerCase() || "";
  return (
    !cacheControl.includes("no-store") &&
    !cacheControl.includes("private") &&
    !response.headers.has("set-cookie") &&
    !vary.split(",").some((value) => {
      const header = value.trim();
      return header === "*" || header === "cookie" || header === "authorization";
    })
  );
}

function hasContentType(response, type) {
  return response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === type;
}

function isPublicResource(response, pathname, type) {
  return (
    response &&
    response.status === 200 &&
    response.url === new URL(pathname, self.location.origin).href &&
    isSafeToCache(response) &&
    hasContentType(response, type) &&
    response.headers.get("content-security-policy") === OFFLINE_CSP
  );
}

async function getOfflineFallback() {
  const current = await caches.match(OFFLINE_FALLBACK_URL, { cacheName: CACHE_NAME });
  if (isPublicResource(current, OFFLINE_FALLBACK_URL, "text/html")) {
    return current;
  }

  const legacy = await caches.match("/", { cacheName: LEGACY_CACHE_NAME });
  if (isPublicResource(legacy, "/", "text/html")) {
    return legacy;
  }
}

async function precachePublicResource(pathname, type) {
  const response = await fetch(new URL(pathname, self.location.origin).href, {
    headers: { Accept: "*/*" },
    credentials: "omit",
    mode: "same-origin",
    redirect: "error",
    cache: "no-store",
  });
  if (!isPublicResource(response, pathname, type)) {
    return false;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(pathname, response);
  return true;
}

function refreshOfflineFallback() {
  fallbackRefresh ??= precachePublicResource(OFFLINE_FALLBACK_URL, "text/html")
    .catch(() => false)
    .finally(() => {
      fallbackRefresh = undefined;
    });
  return fallbackRefresh;
}

async function installOfflineCache() {
  const [updated] = await Promise.all([
    refreshOfflineFallback(),
    precachePublicResource(MANIFEST_URL, "application/manifest+json").catch(() => false),
  ]);
  if (!updated && !(await getOfflineFallback())) {
    throw new Error("No valid public offline document");
  }
  await self.skipWaiting();
}

function networkFirstNavigation(event, url) {
  const network = fetch(event.request);
  event.respondWith(network.catch(async (error) => {
    const fallback = await getOfflineFallback();
    if (fallback) {
      return fallback;
    }
    throw error;
  }));

  if (url.pathname === "/" && !url.search) {
    // The refresh has its own lifetime and does not delay the online document.
    event.waitUntil(network.then((response) => {
      if (response.status === 200 && !response.redirected && hasContentType(response, "text/html")) {
        return refreshOfflineFallback();
      }
    }).catch(() => undefined));
  }
}

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const legacy = await caches.match(request, { cacheName: LEGACY_CACHE_NAME });
  if (legacy && isSafeToCache(legacy)) {
    return legacy;
  }

  const networkResponse = await fetch(request, { credentials: "omit" });
  if (isSafeToCache(networkResponse)) {
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

self.addEventListener("install", (event) => {
  event.waitUntil(installOfflineCache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Keep the migration source and its versioned assets during v3.
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== LEGACY_CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || hasCredentialsHeader(request)) {
    return;
  }

  if (!request.url.startsWith("http")) {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) {
    return;
  }

  if (isNavigationRequest(request)) {
    networkFirstNavigation(event, url);
    return;
  }

  if (isStaticAssetRequest(url)) {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});
