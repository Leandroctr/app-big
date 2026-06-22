import { appConfig } from "@/lib/app-config";

export type AppSettings = {
  id?: string;
  appName: string;
  appShortName: string;
  appDescription: string;
  platformUrl: string;
  supportUrl: string;
  publicUrl: string;
  logoUrl: string;
  icon192Url: string;
  icon512Url: string;
  faviconUrl: string;
  themeColor: string;
  backgroundColor: string;
  splashTitle: string;
  splashMessage: string;
  redirectDelayMs: number;
  notificationsEnabled: boolean;
  oneSignalAppId: string;
  updatedAt?: string;
};

export type AppSettingsRow = {
  id?: string;
  app_name?: string | null;
  app_short_name?: string | null;
  app_description?: string | null;
  platform_url?: string | null;
  support_url?: string | null;
  public_url?: string | null;
  logo_url?: string | null;
  icon_192_url?: string | null;
  icon_512_url?: string | null;
  favicon_url?: string | null;
  theme_color?: string | null;
  background_color?: string | null;
  splash_title?: string | null;
  splash_message?: string | null;
  redirect_delay_ms?: number | null;
  notifications_enabled?: boolean | null;
  onesignal_app_id?: string | null;
  updated_at?: string | null;
};

export const placeholderIcons = {
  icon192: "/icons/icon-192.svg",
  icon512: "/icons/icon-512.svg",
};

export function getFallbackAppSettings(): AppSettings {
  return {
    appName: appConfig.name,
    appShortName: appConfig.shortName,
    appDescription: appConfig.description,
    platformUrl: appConfig.platformUrl,
    supportUrl: appConfig.supportUrl,
    publicUrl: appConfig.publicUrl,
    logoUrl: appConfig.logoUrl,
    icon192Url: placeholderIcons.icon192,
    icon512Url: placeholderIcons.icon512,
    faviconUrl: "",
    themeColor: appConfig.themeColor,
    backgroundColor: appConfig.backgroundColor,
    splashTitle: appConfig.name,
    splashMessage: "Carregando ambiente seguro...",
    redirectDelayMs: 1500,
    notificationsEnabled: false,
    oneSignalAppId: appConfig.oneSignalAppId,
  };
}

function textOrFallback(value: string | null | undefined, fallback: string) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberOrFallback(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value) || !value) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

export function settingsRowToAppSettings(
  row?: AppSettingsRow | null,
): AppSettings {
  const fallback = getFallbackAppSettings();

  if (!row) {
    return fallback;
  }

  return {
    id: row.id,
    appName: textOrFallback(row.app_name, fallback.appName),
    appShortName: textOrFallback(row.app_short_name, fallback.appShortName),
    appDescription: textOrFallback(row.app_description, fallback.appDescription),
    platformUrl: textOrFallback(row.platform_url, fallback.platformUrl),
    supportUrl: textOrFallback(row.support_url, fallback.supportUrl),
    publicUrl: textOrFallback(row.public_url, fallback.publicUrl),
    logoUrl: textOrFallback(row.logo_url, fallback.logoUrl),
    icon192Url: textOrFallback(row.icon_192_url, fallback.icon192Url),
    icon512Url: textOrFallback(row.icon_512_url, fallback.icon512Url),
    faviconUrl: textOrFallback(row.favicon_url, fallback.faviconUrl),
    themeColor: textOrFallback(row.theme_color, fallback.themeColor),
    backgroundColor: textOrFallback(
      row.background_color,
      fallback.backgroundColor,
    ),
    splashTitle: textOrFallback(row.splash_title, fallback.splashTitle),
    splashMessage: textOrFallback(row.splash_message, fallback.splashMessage),
    redirectDelayMs: numberOrFallback(
      row.redirect_delay_ms,
      fallback.redirectDelayMs,
    ),
    notificationsEnabled: Boolean(row.notifications_enabled),
    oneSignalAppId: textOrFallback(
      row.onesignal_app_id,
      fallback.oneSignalAppId,
    ),
    updatedAt: row.updated_at || undefined,
  };
}

export function appSettingsToRow(settings: Partial<AppSettings>) {
  return {
    app_name: settings.appName,
    app_short_name: settings.appShortName,
    app_description: settings.appDescription,
    platform_url: settings.platformUrl,
    support_url: settings.supportUrl,
    public_url: settings.publicUrl,
    logo_url: settings.logoUrl,
    icon_192_url: settings.icon192Url,
    icon_512_url: settings.icon512Url,
    favicon_url: settings.faviconUrl,
    theme_color: settings.themeColor,
    background_color: settings.backgroundColor,
    splash_title: settings.splashTitle,
    splash_message: settings.splashMessage,
    redirect_delay_ms: settings.redirectDelayMs,
    notifications_enabled: settings.notificationsEnabled,
    onesignal_app_id: settings.oneSignalAppId,
    updated_at: new Date().toISOString(),
  };
}
