import type { Metadata } from "next";
import { PwaInstallPage } from "@/components/pwa-install-page";
import { getAppSettings } from "@/lib/app-settings.server";
import { placeholderIcons, type AppSettings } from "@/lib/app-settings";
import { getInstallUrl } from "@/lib/pwa-install";
import { installBrandByDomain, type InstallBrand } from "@/lib/pwa-install-brand";

export const dynamic = "force-dynamic";

function getInstallBrand(settings: AppSettings): InstallBrand {
  const brand = Object.hasOwn(installBrandByDomain, settings.tenantDomain ?? "")
    ? installBrandByDomain[settings.tenantDomain ?? ""]
    : undefined;

  return {
    name: settings.appShortName || settings.appName,
    iconUrl: [settings.icon512Url, settings.icon192Url].find(
      (url) => url && url !== placeholderIcons.icon512 && url !== placeholderIcons.icon192,
    ),
    themeColor: settings.themeColor,
    backgroundColor: settings.backgroundColor,
    ...brand,
    installUrl: getInstallUrl(settings.publicUrl),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { name } = getInstallBrand(await getAppSettings());

  return {
    title: `Instalar ${name}`,
    description: `Instale ${name} pela experiência oficial do navegador.`,
    robots: {
      index: true,
      follow: false,
    },
  };
}

export default async function InstallPage() {
  return <PwaInstallPage brand={getInstallBrand(await getAppSettings())} />;
}
