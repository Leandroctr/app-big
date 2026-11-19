import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  detectInstallPlatform,
  getReadableTextColor,
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
  assert.match(installComponentSource, /O prompt automático não está disponível agora/);
  assert.match(installComponentSource, /Nenhum APK é baixado/);
  assert.match(installComponentSource, /Adicionar à Tela de Início/);
});

test("manifest, service worker and OneSignal integration invariants remain intact", () => {
  assert.match(manifestSource, /start_url: "\/"/);
  assert.match(manifestSource, /display: "standalone"/);
  assert.match(serviceWorkerSource, /const CACHE_NAME = `\$\{CACHE_PREFIX\}v2`/);
  assert.match(serviceWorkerSource, /const PRECACHE_URLS = \[OFFLINE_FALLBACK_URL, "\/manifest\.webmanifest"\]/);
  assert.match(notificationBannerSource, /pathname === "\/instalar"/);
  assert.match(notificationBannerSource, /!isInstallRoute/);
});
