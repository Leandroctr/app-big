export type InstallBrand = {
  name: string;
  tagline?: string;
  iconUrl?: string;
  logoUrl?: string;
  mascotUrl?: string;
  installUrl?: string;
  themeColor: string;
  backgroundColor: string;
  heroBackground?: string;
  heroInsetShadow?: string;
  heroHighlight?: string;
  heroGlow?: string;
  heroLogoShadow?: string;
  mascotShadow?: string;
  coins?: { border: string; background: string; shadow: string };
  actionBackground?: string;
  actionInsetShadow?: string;
  actionTextColor?: string;
  instructionsBackground?: string;
  stepBackground?: string;
  stepTileBackground?: string;
  stepTileShadow?: string;
};

export const installBrandByDomain: Readonly<Record<string, Partial<Omit<InstallBrand, "installUrl">>>> = {
  "pwa.app-bigpix.com": {
    name: "BigPix",
    tagline: "O seu app de jogos em um só lugar!",
    iconUrl: "/brands/bigpix/icon.png",
    logoUrl: "/brands/bigpix/logo.png",
    mascotUrl: "/brands/bigpix/tiger.png",
    themeColor: "#6e00b8",
    backgroundColor: "#fcfcfe",
    heroBackground: "radial-gradient(ellipse 100% 95% at 17% 50%, #9d22eb 0%, #8100bd 34%, #d12ac6 90%, #7c08b6 120%)",
    heroInsetShadow: "inset 0 0 18px #ff73e877",
    heroHighlight: "linear-gradient(90deg, transparent, #ff72e8, transparent)",
    heroGlow: "radial-gradient(ellipse at 48% 78%, #ffbafbdf, #fa59fa55 31%, transparent 62%), linear-gradient(90deg, transparent, #fa59fa2a, #ffbafb70, #c120ff22, transparent)",
    heroLogoShadow: "drop-shadow(0 2px 1px #2b003c77)",
    mascotShadow: "drop-shadow(-3px 3px 3px #3f005129)",
    coins: {
      border: "#ffc133",
      background: "radial-gradient(ellipse at 40% 38%, #ffed6a, #e39000 65%)",
      shadow: "0 3px 0 #e39000, 0 6px 5px #5a0e9e66, inset 0 0 0 2px #ffdd5b",
    },
    actionBackground: "linear-gradient(180deg, #ae30f5 0%, #7d00d6 69%, #6b00c3 100%)",
    actionInsetShadow: "inset 0 1px 0 #ae6ee5",
    actionTextColor: "#fff",
    instructionsBackground: "linear-gradient(120deg, #f7f6ff 0%, #f6f3fe 50%, #f3effa 100%)",
    stepBackground: "linear-gradient(135deg, #bd57ee, #5e00ca)",
    stepTileBackground: "linear-gradient(145deg, #faf9ff, #fff)",
    stepTileShadow: "0 3px 5px #a99ed354",
  },
};
