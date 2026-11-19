import type { Metadata } from "next";
import { PwaInstallPage } from "@/components/pwa-install-page";
import { getAppSettings } from "@/lib/app-settings.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const appName = settings.appShortName || settings.appName;

  return {
    title: `Instalar ${appName}`,
    description: `Instale ${appName} pela experiência oficial do navegador.`,
    robots: {
      index: true,
      follow: false,
    },
  };
}

export default async function InstallPage() {
  const settings = await getAppSettings();

  return (
    <PwaInstallPage
      appName={settings.appName}
      appShortName={settings.appShortName}
      backgroundColor={settings.backgroundColor}
      iconUrl={settings.icon512Url || settings.icon192Url || settings.logoUrl}
      themeColor={settings.themeColor}
    />
  );
}
