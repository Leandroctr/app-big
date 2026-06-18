import type { MetadataRoute } from "next";
import { appConfig, appIconConfig } from "@/lib/app-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.shortName,
    description: appConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: appConfig.backgroundColor,
    theme_color: appConfig.themeColor,
    icons: appIconConfig,
  };
}
