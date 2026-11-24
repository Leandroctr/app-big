"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { NativeSplash } from "@/components/native-splash";
import { NotificationButton } from "@/components/notification-button";
import { getRootAdminAuthCallbackTarget } from "@/lib/admin-invite";
import { appConfigClient } from "@/lib/app-config.client";
import type { AppSettings } from "@/lib/app-settings";

type LauncherSettings = Pick<AppSettings,
  "appName" | "logoUrl" | "icon192Url" | "icon512Url" | "splashImageUrl" |
  "themeColor" | "backgroundColor" | "splashTitle" | "splashMessage" |
  "platformUrl" | "supportUrl" | "redirectDelayMs" | "notificationsEnabled"
>;

const fallbackSettings: LauncherSettings = {
  appName: appConfigClient.appName,
  platformUrl: appConfigClient.platformUrl,
  supportUrl: appConfigClient.supportUrl,
  logoUrl: appConfigClient.logoUrl,
  icon192Url: "/icons/icon-192.svg",
  icon512Url: "/icons/icon-512.svg",
  themeColor: appConfigClient.themeColor,
  backgroundColor: appConfigClient.backgroundColor,
  splashTitle: appConfigClient.appName,
  splashMessage: "Carregando ambiente seguro...",
  splashImageUrl: appConfigClient.splashImageUrl,
  redirectDelayMs: 1500,
  notificationsEnabled: false,
};

export default function Home() {
  const [resolvedSettings, setResolvedSettings] = useState<LauncherSettings | null>(null);
  const hasRedirected = useRef(false);
  const settings = resolvedSettings ?? fallbackSettings;
  const platformUrl = resolvedSettings?.platformUrl.trim();
  const openUrl = platformUrl && platformUrl !== "#" ? platformUrl : undefined;

  const redirectToPlatform = useCallback((url: string) => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    window.location.assign(url);
  }, []);

  useEffect(() => {
    const { search, hash } = window.location;
    const authCallbackTarget = getRootAdminAuthCallbackTarget(search, hash);
    if (authCallbackTarget) {
      window.location.replace(authCallbackTarget + search + hash);
      return;
    }

    const controller = new AbortController();
    const settingsTimer = window.setTimeout(() => controller.abort(), 5000);
    let active = true;
    let redirectTimer: number | undefined;
    let pushSyncListener: (() => void) | undefined;

    async function loadSettings() {
      let loaded = fallbackSettings;
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (response.ok && result?.settings) loaded = result.settings;
      } catch {
        // The bundled settings keep the launcher available when the network fails.
      } finally {
        window.clearTimeout(settingsTimer);
      }
      if (!active) return;

      const url = loaded.platformUrl.trim();
      setResolvedSettings(loaded);
      if (url && url !== "#") {
        pushSyncListener = () => redirectToPlatform(url);
        window.addEventListener("push-sync-settled", pushSyncListener, { once: true });
        redirectTimer = window.setTimeout(() => redirectToPlatform(url), loaded.redirectDelayMs);
      }
    }

    void loadSettings();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(settingsTimer);
      window.clearTimeout(redirectTimer);
      if (pushSyncListener) {
        window.removeEventListener("push-sync-settled", pushSyncListener);
      }
    };
  }, [redirectToPlatform]);

  function openNow(event: MouseEvent<HTMLAnchorElement>) {
    if (!openUrl || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    redirectToPlatform(openUrl);
  }

  return (
    <NativeSplash
      appName={settings.appName}
      logoUrl={settings.logoUrl}
      iconUrl={settings.icon512Url || settings.icon192Url}
      splashImageUrl={settings.splashImageUrl}
      themeColor={settings.themeColor}
      backgroundColor={settings.backgroundColor}
      splashTitle={settings.splashTitle}
      splashMessage={settings.splashMessage}
      openUrl={openUrl}
      supportUrl={settings.supportUrl}
      hasPlatformError={resolvedSettings !== null && !openUrl}
      onOpen={openNow}
    >
      {settings.notificationsEnabled && (
        <details className="mt-1">
          <summary className="cursor-pointer rounded px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2">
            Notificações
          </summary>
          <div className="mx-auto mt-2 w-fit max-w-full">
            <NotificationButton themeColor={settings.themeColor} />
          </div>
        </details>
      )}
    </NativeSplash>
  );
}
