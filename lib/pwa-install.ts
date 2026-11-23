export type InstallPlatform = "android" | "ios" | "desktop" | "other";

export function detectInstallPlatform(
  userAgent: string,
  navigatorPlatform = "",
  maxTouchPoints = 0,
): InstallPlatform {
  const isIPadDesktopMode = navigatorPlatform === "MacIntel" && maxTouchPoints > 1;

  if (/iPad|iPhone|iPod/i.test(userAgent) || isIPadDesktopMode) {
    return "ios";
  }

  if (/Android/i.test(userAgent)) {
    return "android";
  }

  if (/Windows|Macintosh|CrOS|Linux x86_64/i.test(userAgent)) {
    return "desktop";
  }

  return "other";
}

export function isStandaloneMode(
  displayModeStandalone: boolean,
  navigatorStandalone = false,
): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function isIosSafari(userAgent: string): boolean {
  return /Version\/\S+.*Safari\//i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|YaBrowser|Instagram|FBAN|FBAV|FB_IAB|WhatsApp|TikTok|Line\//i.test(userAgent);
}

export function getInstallUrl(publicUrl: string): string | undefined {
  try {
    const url = new URL("/instalar", publicUrl);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    // When no public URL is configured, the browser supplies the current origin.
  }
}

export function getReadableTextColor(backgroundColor: string): "#ffffff" | "#111827" {
  const normalized = backgroundColor.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return "#ffffff";
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 160 ? "#111827" : "#ffffff";
}
