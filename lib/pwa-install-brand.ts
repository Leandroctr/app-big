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
  actionBackground?: string;
  actionTextColor?: string;
  instructionsBackground?: string;
  stepBackground?: string;
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
    heroBackground: "radial-gradient(ellipse at 24% 48%, #ab29ef, #8100bd 52%, #c226ba 91%, #8c08c2)",
    actionBackground: "linear-gradient(180deg, #9830df, #7900cc 65%, #6000b3)",
    actionTextColor: "#fff",
    instructionsBackground: "linear-gradient(120deg, #f5f3ff, #f3effa)",
    stepBackground: "linear-gradient(135deg, #8d26d0, #5e00bb)",
  },
};
