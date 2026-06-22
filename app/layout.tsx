import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getAppSettings } from "@/lib/app-settings.server";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();

  return {
    title: settings.appName,
    description: settings.appDescription,
    applicationName: settings.appName,
    manifest: "/manifest.webmanifest",
    metadataBase: settings.publicUrl ? new URL(settings.publicUrl) : undefined,
    icons: {
      icon: settings.faviconUrl || settings.icon192Url || "/icons/icon-192.svg",
      apple: settings.icon192Url || "/icons/icon-192.svg",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: settings.appShortName,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getAppSettings();

  return {
    themeColor: settings.themeColor,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
