import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/app-settings.server";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAppSettings();

  return {
    name: settings.appName,
    short_name: settings.appShortName,
    description: settings.appDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: settings.backgroundColor,
    theme_color: settings.themeColor,
    icons: [
      {
        src: settings.icon192Url || "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: settings.icon512Url || "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
