"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  detectInstallPlatform,
  getReadableTextColor,
  isIosSafari,
  isStandaloneMode,
  type InstallPlatform,
} from "@/lib/pwa-install";
import type { InstallBrand } from "@/lib/pwa-install-brand";
import styles from "./pwa-install-page.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallPhase =
  | "checking"
  | "available"
  | "prompting"
  | "accepted"
  | "installed"
  | "standalone"
  | "unavailable";

const instructions = {
  ios: {
    title: "Como instalar no iPhone",
    lead: "Adicione esta página do aplicativo à sua tela de início usando o Safari.",
    steps: [
      ["safari", "Abra esta página no Safari", "Mantenha esta página aberta no Safari do iPhone."],
      ["share", "Toque em Compartilhar", "Se precisar, abra primeiro o menu da página do Safari."],
      ["add", "Adicionar à Tela de Início", "Ative “Abrir como App da Web”, se aparecer, e toque em Adicionar."],
    ],
  },
  android: {
    title: "Como instalar no Android",
    lead: "Siga estes passos se o convite de instalação não aparecer.",
    steps: [
      ["menu", "Abra o menu do navegador", "Use os três pontos no Chrome ou em outro navegador compatível."],
      ["add", "Escolha a opção de instalação", "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”."],
      ["check", "Confirme e abra pelo ícone", "Encontre o aplicativo na sua tela inicial."],
    ],
  },
  desktop: {
    title: "Como instalar no computador",
    lead: "Abra esta página no Chrome ou no Edge.",
    steps: [
      ["download", "Encontre a opção de instalação", "Use o ícone na barra de endereço ou abra o menu do navegador."],
      ["add", "Confirme a instalação", "Confirme a opção de instalar no navegador."],
      ["check", "Abra pelo ícone", "Use o ícone criado pelo navegador."],
    ],
  },
  other: {
    title: "Como instalar pelo navegador",
    lead: "Use um navegador compatível com a instalação de aplicativos.",
    steps: [
      ["chrome", "Abra esta página no navegador", "Use o Chrome, Edge ou Safari no seu dispositivo."],
      ["add", "Procure a opção de instalação", "Abra o menu do navegador ou use Compartilhar no Safari."],
      ["check", "Confirme e abra pelo ícone", "Se a opção estiver disponível, confirme e use o ícone criado."],
    ],
  },
} as const;

const lineIcons = {
  download: "M12 3v13m0 0-5-5m5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  share: "M8 9H6.5A2.5 2.5 0 0 0 4 11.5v8A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 17.5 9H16M12 15V2m0 0L8 6m4-4 4 4",
  add: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm5 4v8m-4-4h8",
  menu: "M12 5h.01M12 12h.01M12 19h.01",
  check: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm1 8 3 3 5-6",
};

function InstallIcon({ name, className }: {
  name: keyof typeof lineIcons | "apple" | "safari" | "chrome";
  className?: string;
}) {
  if (name === "apple") {
    return (
      <svg viewBox="0 0 24 26" className={className} aria-hidden="true">
        <path fill="currentColor" d="M16.8 1.1c-.2 1.5-.9 2.7-2 3.6-1 .9-2.3 1.4-3.6 1.3.1-1.4.8-2.8 1.8-3.7 1-1 2.3-1.6 3.8-1.8v.6zM21.8 18.7c-.5 1.2-.8 1.7-1.5 2.8-.9 1.4-2.1 3.1-3.7 3.1-1.4 0-1.8-.9-3.8-.9-2 0-2.5.9-3.8.9-1.6.1-2.8-1.7-3.7-3-2.5-3.8-2.8-8.3-1.3-10.7 1-1.7 2.8-2.7 4.6-2.7 1.5 0 2.6.9 3.7.9 1 0 2.7-1.1 4.5-.9 1.5.1 3 .8 4 2-3.5 2-3 6.9 1 8.3z" />
      </svg>
    );
  }
  if (name === "safari") {
    return (
      <svg viewBox="0 0 56 56" className={className} aria-hidden="true">
        <circle cx="28" cy="28" r="24" fill="#02aaf0" stroke="#b8dbf5" strokeWidth="2" />
        <circle cx="28" cy="28" r="20.5" fill="none" stroke="white" strokeDasharray="1.2 2.3" opacity=".65" />
        <path d="m39 14-8 17-12 7 7-17z" fill="#f04442" />
        <path d="m26 21 5 10-12 7z" fill="white" />
      </svg>
    );
  }
  if (name === "chrome") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <circle cx="24" cy="24" r="21" fill="#e8473a" />
        <path d="M5.8 13.5 16 30a9.5 9.5 0 0 0 16 0L22 44.9A21 21 0 0 1 5.8 13.5Z" fill="#34a853" />
        <path d="M24 14.5h18.7A21 21 0 0 1 22 44.9l10.2-16.2A9.5 9.5 0 0 0 24 14.5Z" fill="#f5d34c" />
        <circle cx="24" cy="24" r="9.5" fill="#3187e6" stroke="white" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d={lineIcons[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InstallInstructions({
  platform,
  safari,
  installUrl,
}: {
  platform: InstallPlatform;
  safari: boolean;
  installUrl?: string;
}) {
  const { title, lead, steps } = instructions[platform];
  const showSafariAddress = platform === "ios" && !safari && installUrl;

  return (
    <section className={styles.card} id="instrucoes" aria-labelledby="instrucoes-titulo" tabIndex={-1}>
      <div className={styles.cardHeading}>
        <InstallIcon name={platform === "ios" ? "apple" : "chrome"} className={styles.systemIcon} />
        <div>
          <h2 id="instrucoes-titulo">{title}</h2>
          <p>{lead}</p>
        </div>
      </div>
      <ol className={styles.steps} role="list">
        {steps.map(([icon, heading, description], index) => (
          <li key={heading} className={styles.step}>
            <span className={styles.stepIcon}><InstallIcon name={icon} /></span>
            <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{heading}</h3>
              {index === 0 && showSafariAddress ? (
                <p>Copie este endereço e cole no Safari <strong className={styles.installUrl}>{installUrl}</strong></p>
              ) : <p>{description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PwaInstallPage({ brand }: { brand: InstallBrand }) {
  const [phase, setPhase] = useState<InstallPhase>("checking");
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [safari, setSafari] = useState(false);
  const [currentInstallUrl, setCurrentInstallUrl] = useState<string>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const pageStyle = {
    "--install-primary": brand.themeColor,
    "--install-background": brand.backgroundColor,
    "--install-hero": brand.heroBackground,
    "--install-hero-shadow": brand.heroInsetShadow,
    "--install-hero-highlight": brand.heroHighlight,
    "--install-hero-glow": brand.heroGlow,
    "--install-logo-shadow": brand.heroLogoShadow,
    "--install-mascot-shadow": brand.mascotShadow,
    "--install-coin-border": brand.coins?.border,
    "--install-coin-background": brand.coins?.background,
    "--install-coin-shadow": brand.coins?.shadow,
    "--install-action": brand.actionBackground,
    "--install-action-shadow": brand.actionInsetShadow,
    "--install-on-action": brand.actionTextColor ?? getReadableTextColor(brand.themeColor),
    "--install-card": brand.instructionsBackground,
    "--install-step": brand.stepBackground,
    "--install-step-tile": brand.stepTileBackground,
    "--install-step-tile-shadow": brand.stepTileShadow,
  } as CSSProperties;

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const detectedPlatform = detectInstallPlatform(
      navigator.userAgent, navigator.platform, navigator.maxTouchPoints,
    );
    const platformTimer = window.setTimeout(() => {
      setPlatform(detectedPlatform);
      setSafari(detectedPlatform === "ios" && isIosSafari(navigator.userAgent));
      setCurrentInstallUrl(window.location.origin + window.location.pathname);
    }, 0);

    const updateStandaloneState = () => {
      if (isStandaloneMode(displayMode.matches, navigatorWithStandalone.standalone === true)) {
        setInstallPrompt(null);
        setPhase("standalone");
        return true;
      }
      return false;
    };

    if (updateStandaloneState()) {
      return () => window.clearTimeout(platformTimer);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (detectedPlatform === "ios") return;

      setInstallPrompt(event as BeforeInstallPromptEvent);
      setPhase((current) => ["installed", "standalone", "prompting"].includes(current) ? current : "available");
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setPhase((current) => current === "standalone" ? current : "installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener?.("change", updateStandaloneState);

    const fallbackTimer = window.setTimeout(() => {
      setPhase((current) => current === "checking" ? "unavailable" : current);
    }, detectedPlatform === "ios" ? 0 : 1500);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(platformTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener?.("change", updateStandaloneState);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPrompt) return;

    setPhase("prompting");
    setInstallPrompt(null);
    let result: InstallPhase = "unavailable";
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") result = "accepted";
    } catch {
      // The manual instructions remain available when the native prompt fails.
    }
    setPhase((current) => current === "prompting" ? result : current);
  }, [installPrompt]);

  const isPrompt = phase === "available" || phase === "prompting";
  const showInstructions = phase === "checking" || phase === "unavailable" || phase === "accepted" || isPrompt;
  const status = {
    checking: "Verificando a instalação disponível…",
    prompting: "Aguardando confirmação do navegador…",
    accepted: "Instalação autorizada. Se o ícone não aparecer, siga as instruções abaixo.",
    installed: "Aplicativo instalado. Abra pelo ícone criado.",
    standalone: "Você já está usando o aplicativo instalado.",
    available: "",
    unavailable: "",
  }[phase];

  return (
    <main className={styles.page} style={pageStyle}>
      <div className={styles.content}>
        <header className={styles.brand}>
          {brand.iconUrl && (
            <Image alt="" className={styles.appIcon} height={96} width={96} src={brand.iconUrl} unoptimized />
          )}
          <div>
            <h1>{brand.name}</h1>
            {brand.tagline && <p>{brand.tagline}</p>}
          </div>
        </header>

        {(brand.logoUrl || brand.mascotUrl) && (
          <div className={styles.hero} aria-hidden="true" data-mascot={Boolean(brand.mascotUrl)}>
            <div className={styles.heroBackground}>
              {brand.heroGlow && <span className={styles.heroGlow} />}
            </div>
            {brand.logoUrl && (
              <Image alt="" className={styles.logo} height={160} width={360} src={brand.logoUrl} unoptimized />
            )}
            {(brand.mascotUrl || brand.coins) && (
              <div className={styles.heroForeground}>
                {brand.mascotUrl && (
                  <Image alt="" className={styles.mascot} height={1075} width={1463} src={brand.mascotUrl} unoptimized />
                )}
                {brand.coins && (
                  <>
                    <span className={styles.coin} />
                    <span className={styles.coin} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {isPrompt ? (
          <button className={styles.action} disabled={phase === "prompting"} onClick={requestInstall} type="button">
            <InstallIcon name="download" className={styles.downloadIcon} />
            Instalar aplicativo
          </button>
        ) : phase === "standalone" ? (
          <Link className={styles.action} href="/">Abrir aplicativo</Link>
        ) : showInstructions ? (
          <a className={styles.action} href="#instrucoes">
            <InstallIcon name="download" className={styles.downloadIcon} />
            Ver como instalar
          </a>
        ) : null}

        <p className={styles.status} role="status">{status}</p>
        {showInstructions && (
          <InstallInstructions platform={platform} safari={safari} installUrl={brand.installUrl ?? currentInstallUrl} />
        )}

        {phase !== "standalone" && (
          <Link className={styles.continue} href="/">Continuar sem instalar</Link>
        )}
      </div>
    </main>
  );
}
