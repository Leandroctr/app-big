export type InstallBrand = {
  name: string;
  iconUrl?: string;
  installUrl?: string;
  themeColor: string;
  backgroundColor: string;
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
    iconUrl: "/brands/bigpix/icon.png",
    themeColor: "#6e00b8",
    backgroundColor: "#fcfcfe",
    actionBackground: "linear-gradient(180deg, #ae30f5 0%, #7d00d6 69%, #6b00c3 100%)",
    actionInsetShadow: "inset 0 1px 0 #ae6ee5",
    actionTextColor: "#fff",
    instructionsBackground: "linear-gradient(120deg, #f7f6ff 0%, #f6f3fe 50%, #f3effa 100%)",
    stepBackground: "linear-gradient(135deg, #bd57ee, #5e00ca)",
    stepTileBackground: "linear-gradient(145deg, #faf9ff, #fff)",
    stepTileShadow: "0 3px 5px #a99ed354",
  },
};
