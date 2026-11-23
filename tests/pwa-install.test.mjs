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
const manifestSource = readFileSync("app/manifest.ts", "utf8");
const serviceWorkerSource = readFileSync("public/sw.js", "utf8");
const notificationBannerSource = readFileSync("components/notification-vip-banner.tsx", "utf8");

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
  assert.match(homeSource, /loadedSettings\.redirectDelayMs/);
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

test("the shared component uses only assets from the supplied brand", () => {
  assert.doesNotMatch(installComponentSource, /bigpix|apkbig|placeholder/i);
  assert.match(installComponentSource, /src=\{brand\.iconUrl\}/);
  assert.match(installComponentSource, /src=\{brand\.logoUrl\}/);
  assert.match(installComponentSource, /src=\{brand\.mascotUrl\}/);
});

test("manifest, service worker and OneSignal integration invariants remain intact", () => {
  assert.match(manifestSource, /start_url: "\/"/);
  assert.match(manifestSource, /display: "standalone"/);
  assert.match(serviceWorkerSource, /const CACHE_NAME = `\$\{CACHE_PREFIX\}v2`/);
  assert.match(serviceWorkerSource, /const PRECACHE_URLS = \[OFFLINE_FALLBACK_URL, "\/manifest\.webmanifest"\]/);
  assert.match(notificationBannerSource, /pathname === "\/instalar"/);
  assert.match(notificationBannerSource, /!isInstallRoute/);
});
