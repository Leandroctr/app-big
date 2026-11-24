import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  detectInstallPlatform,
  getInstallUrl,
  getReadableTextColor,
  isIosSafari,
  isStandaloneMode,
} from "../lib/pwa-install.ts";

const installPageSource = readFileSync("app/instalar/page.tsx", "utf8");
const installComponentSource = readFileSync("components/pwa-install-page.tsx", "utf8");
const homeSource = readFileSync("app/page.tsx", "utf8");
const splashSource = readFileSync("components/native-splash.tsx", "utf8");
const splashStyles = readFileSync("components/native-splash.module.css", "utf8");
const manifestSource = readFileSync("app/manifest.ts", "utf8");
const serviceWorkerSource = readFileSync("public/sw.js", "utf8");
const notificationBannerSource = readFileSync("components/notification-vip-banner.tsx", "utf8");
const oneSignalInitializer = readFileSync("components/onesignal-initializer.tsx", "utf8");

test("platform detection covers Android, iOS including iPad desktop mode, and desktop", () => {
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Linux; Android 15) Chrome/140"), "android");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), "ios");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Macintosh)", "MacIntel", 5), "ios");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
});

test("standalone detection accepts both display-mode and the iOS navigator flag", () => {
  assert.equal(isStandaloneMode(true, false), true);
  assert.equal(isStandaloneMode(false, true), true);
  assert.equal(isStandaloneMode(false, false), false);
});

test("iOS Safari detection excludes other browsers and embedded browsers", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0) Version/26.0 Mobile/15E148 Safari/604.1";
  assert.equal(isIosSafari(safari), true);
  assert.equal(isIosSafari(safari.replace("Version/26.0", "CriOS/140.0")), false);
  assert.equal(isIosSafari(`${safari} Instagram 400`), false);
});

test("the manual install address uses the configured PWA origin and dedicated route", () => {
  assert.equal(getInstallUrl("https://pwa.example.com/landing?campaign=a"), "https://pwa.example.com/instalar");
  assert.equal(getInstallUrl("http://localhost:3000/"), "http://localhost:3000/instalar");
  assert.equal(getInstallUrl("ftp://example.com/"), undefined);
  assert.equal(getInstallUrl(""), undefined);
});

test("brand button text keeps readable contrast for light and dark colors", () => {
  assert.equal(getReadableTextColor("#ffffff"), "#111827");
  assert.equal(getReadableTextColor("#000000"), "#ffffff");
  assert.equal(getReadableTextColor("#fff"), "#111827");
  assert.equal(getReadableTextColor("not-a-color"), "#ffffff");
});

test("the dedicated install route is isolated from the public launcher redirect", () => {
  assert.match(installPageSource, /PwaInstallPage/);
  assert.doesNotMatch(installPageSource, /NEXT_PUBLIC_PLATFORM_URL|window\.location|redirectToPlatform/);
  assert.match(homeSource, /window\.location\.assign\(url\)/);
  assert.match(homeSource, /setTimeout\(\(\) => redirectToPlatform\(url\), loaded\.redirectDelayMs\)/);
});

test("the launcher always renders the native splash and leaves legacy HTML inert", () => {
  assert.match(homeSource, /<NativeSplash\b/);
  assert.doesNotMatch(homeSource + splashSource, /splashHtmlUrl|<iframe|srcDoc|dangerouslySetInnerHTML|\bBlob\b/);
  assert.match(homeSource, /fetch\("\/api\/settings"/);
  assert.match(homeSource, /hasRedirected\.current = true;\s+window\.location\.assign\(url\)/);
  assert.match(homeSource, /addEventListener\("push-sync-settled", pushSyncListener, \{ once: true \}\)/);
  assert.match(homeSource, /redirectToPlatform\(openUrl\)/);
});

test("splash separates logo and artwork and retains accessible controls with reduced motion", () => {
  assert.match(splashSource, /imageSource\(splashImageUrl\)/);
  assert.match(splashSource, /<Image alt="" className=\{styles\.artwork\}[^>]+src=\{artwork\}/);
  assert.match(splashSource, /<SplashMark[^>]+logo=\{logo\}/);
  assert.match(splashSource, /<p role="status">/);
  assert.match(splashSource, />Abrir agora</);
  assert.match(splashSource, />Suporte</);
  assert.match(splashStyles, /\.primary:focus-visible/);
  assert.match(splashStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*animation: none/);
});

test("installation is requested only from the explicit user action", () => {
  assert.match(installComponentSource, /addEventListener\("beforeinstallprompt"/);
  assert.match(installComponentSource, /event\.preventDefault\(\)/);
  assert.match(installComponentSource, /onClick=\{requestInstall\}/);
  assert.match(installComponentSource, /await installPrompt\.prompt\(\)/);
  assert.match(installComponentSource, /await installPrompt\.userChoice/);
  assert.match(installComponentSource, /addEventListener\("appinstalled"/);
});

test("standalone and no-prompt states have explicit safe fallbacks", () => {
  assert.match(installComponentSource, /display-mode: standalone/);
  assert.match(installComponentSource, /Abrir aplicativo/);
  assert.match(installComponentSource, /Ver como instalar/);
  assert.match(installComponentSource, /Copie este endereço e cole no Safari/);
  assert.match(installComponentSource, /Adicionar à Tela de Início/);
});

test("the installation center uses only the supplied brand's app icon", () => {
  assert.doesNotMatch(installComponentSource, /bigpix|apkbig|placeholder/i);
  const images = installComponentSource.match(/<Image\b[^>]*>/g) ?? [];
  assert.equal(images.length, 1);
  assert.match(images[0], /src=\{brand\.iconUrl\}/);
});

test("manifest, service worker and OneSignal integration invariants remain intact", () => {
  assert.match(manifestSource, /start_url: "\/"/);
  assert.match(manifestSource, /display: "standalone"/);
  assert.match(serviceWorkerSource, /const CACHE_NAME = CACHE_PREFIX \+ "v3"/);
  assert.match(serviceWorkerSource, /const LEGACY_CACHE_NAME = CACHE_PREFIX \+ "v2"/);
  assert.match(serviceWorkerSource, /const OFFLINE_FALLBACK_URL = "\/pwa-offline"/);
  assert.match(serviceWorkerSource, /const MANIFEST_URL = "\/manifest\.webmanifest"/);
  assert.match(notificationBannerSource, /pathname === "\/instalar"/);
  assert.match(notificationBannerSource, /!isInstallRoute/);
});

test("BigPix handles administrative callbacks before launcher or OneSignal work", () => {
  const callback = homeSource.indexOf("getRootAdminAuthCallbackTarget(search, hash)");
  const fetchSettings = homeSource.indexOf('fetch("/api/settings"');
  assert.ok(callback >= 0 && callback < fetchSettings);
  assert.match(homeSource, /location\.replace\(authCallbackTarget \+ search \+ hash\);\s+return;/);
  const guard = 'if (pathname === "/" && getRootAdminAuthCallbackTarget(search, hash)) return;';
  const skip = oneSignalInitializer.indexOf(guard);
  assert.ok(skip >= 0 && skip < oneSignalInitializer.indexOf("window.__ONESIGNAL_INITED__ = true"));
  assert.ok(skip < oneSignalInitializer.indexOf("OneSignal.init({"));
});
