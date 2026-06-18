export type AppConfig = {
  name: string;
  shortName: string;
  description: string;
  platformUrl: string;
  supportUrl: string;
  publicUrl: string;
  logoUrl: string;
  themeColor: string;
  backgroundColor: string;
  oneSignalAppId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  mode: string;
};

function readEnv(name: string, fallback = "") {
  return process.env[name] || fallback;
}

const defaultName = "App Big";
const defaultDescription = "PWA mobile-first para acesso rapido a plataforma.";

export const appConfig: AppConfig = {
  name: readEnv("NEXT_PUBLIC_APP_NAME", defaultName),
  shortName: readEnv("NEXT_PUBLIC_APP_SHORT_NAME", defaultName),
  description: readEnv("NEXT_PUBLIC_APP_DESCRIPTION", defaultDescription),
  platformUrl: readEnv("NEXT_PUBLIC_PLATFORM_URL", "#"),
  supportUrl: readEnv("NEXT_PUBLIC_SUPPORT_URL", "#"),
  publicUrl: readEnv("NEXT_PUBLIC_PUBLIC_URL"),
  logoUrl: readEnv("NEXT_PUBLIC_LOGO_URL"),
  themeColor: readEnv("NEXT_PUBLIC_THEME_COLOR", "#101828"),
  backgroundColor: readEnv("NEXT_PUBLIC_BACKGROUND_COLOR", "#f6f7fb"),
  oneSignalAppId: readEnv("NEXT_PUBLIC_ONESIGNAL_APP_ID"),
  supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  mode: readEnv("NEXT_PUBLIC_APP_MODE", process.env.NODE_ENV || "development"),
};

export const appIconConfig = [
  {
    src: "/icons/icon-192.svg",
    sizes: "192x192",
    type: "image/svg+xml",
    purpose: "any" as const,
  },
  {
    src: "/icons/icon-512.svg",
    sizes: "512x512",
    type: "image/svg+xml",
    purpose: "maskable" as const,
  },
];
