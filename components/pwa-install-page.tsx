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
      ["◈", "Abra esta página no Safari", "Use o endereço do aplicativo que está na barra do navegador."],
      ["↑", "Toque em Compartilhar", "Se precisar, abra primeiro o menu da página do Safari."],
      ["+", "Adicionar à Tela de Início", "Selecione a opção, ative “Abrir como App da Web” se aparecer e toque em Adicionar."],
    ],
  },
  android: {
    title: "Como instalar no Android",
    lead: "Siga estes passos se o convite de instalação não aparecer.",
    steps: [
      ["⋮", "Abra o menu do navegador", "Use os três pontos no Chrome ou em outro navegador compatível."],
      ["+", "Escolha a opção de instalação", "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”."],
      ["✓", "Confirme e abra pelo ícone", "Encontre o aplicativo na sua tela inicial."],
    ],
  },
  desktop: {
    title: "Como instalar no computador",
    lead: "Abra esta página no Chrome ou no Edge.",
    steps: [
      ["↓", "Encontre a opção de instalação", "Use o ícone de instalação na barra de endereço ou abra o menu do navegador."],
      ["✓", "Confirme a instalação", "Depois, abra o aplicativo pelo ícone criado."],
    ],
  },
  other: {
    title: "Como instalar pelo navegador",
    lead: "Abra esta página no Chrome, Edge ou Safari e procure a opção de adicionar à tela inicial.",
    steps: [],
  },
};

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
      <h2 id="instrucoes-titulo">{title}</h2>
      <p>{lead}</p>
      {steps.length > 0 && (
        <ol className={styles.steps} role="list">
          {steps.map(([symbol, heading, description], index) => (
            <li key={heading} className={styles.step}>
              <span className={styles.stepIcon} aria-hidden="true">{symbol}</span>
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
      )}
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
    "--install-action": brand.actionBackground,
    "--install-on-action": brand.actionTextColor ?? getReadableTextColor(brand.themeColor),
    "--install-card": brand.instructionsBackground,
    "--install-step": brand.stepBackground,
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
  const showInstructions = phase === "checking" || phase === "unavailable" || isPrompt;
  const status = {
    checking: "Verificando a instalação disponível…",
    prompting: "Aguardando confirmação do navegador…",
    accepted: "Instalação autorizada. Aguarde a conclusão pelo navegador.",
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
            {brand.logoUrl && (
              <Image alt="" className={styles.logo} height={160} width={360} src={brand.logoUrl} unoptimized />
            )}
            {brand.mascotUrl && (
              <div className={styles.mascotFrame}>
                <Image alt="" className={styles.mascot} height={1075} width={1463} src={brand.mascotUrl} unoptimized />
              </div>
            )}
          </div>
        )}

        {isPrompt ? (
          <button className={styles.action} disabled={phase === "prompting"} onClick={requestInstall} type="button">
            <span className={styles.downloadIcon} aria-hidden="true">↓</span>
            Instalar aplicativo
          </button>
        ) : phase === "standalone" ? (
          <Link className={styles.action} href="/">Abrir aplicativo</Link>
        ) : showInstructions ? (
          <a className={styles.action} href="#instrucoes">
            <span className={styles.downloadIcon} aria-hidden="true">↓</span>
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
