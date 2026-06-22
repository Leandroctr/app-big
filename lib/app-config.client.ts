"use client";

export const appConfigClient = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "App Big",
  appShortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "App Big",
  appDescription:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "PWA mobile-first para acesso rapido a plataforma.",
  oneSignalAppId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
  platformUrl: process.env.NEXT_PUBLIC_PLATFORM_URL || "",
  supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || "#",
  publicUrl: process.env.NEXT_PUBLIC_PUBLIC_URL || "",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "",
  splashImageUrl: "",
  themeColor: process.env.NEXT_PUBLIC_THEME_COLOR || "#101828",
  backgroundColor: process.env.NEXT_PUBLIC_BACKGROUND_COLOR || "#f6f7fb",
};
