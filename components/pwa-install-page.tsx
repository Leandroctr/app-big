"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  detectInstallPlatform,
  getReadableTextColor,
  isStandaloneMode,
  type InstallPlatform,
} from "@/lib/pwa-install";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<InstallChoice>;
}

type InstallPhase =
  | "checking"
  | "available"
  | "prompting"
  | "accepted"
  | "installed"
  | "standalone"
  | "unavailable";

type PwaInstallPageProps = {
  appName: string;
  appShortName: string;
  backgroundColor: string;
  iconUrl: string;
  themeColor: string;
};

function AndroidInstructions() {
  return (
    <ol className="mt-5 space-y-3 text-left text-sm font-medium leading-6 text-slate-700">
      <li><strong>1.</strong> Abra o menu do navegador (três pontos).</li>
      <li><strong>2.</strong> Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
      <li><strong>3.</strong> Confirme a instalação e abra pelo novo ícone.</li>
    </ol>
  );
}

function IosInstructions() {
  return (
    <ol className="mt-5 space-y-3 text-left text-sm font-medium leading-6 text-slate-700">
      <li><strong>1.</strong> Abra esta página no Safari.</li>
      <li><strong>2.</strong> Toque no botão <strong>Compartilhar</strong>.</li>
      <li><strong>3.</strong> Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li>
    </ol>
  );
}

function DesktopInstructions() {
  return (
    <ol className="mt-5 space-y-3 text-left text-sm font-medium leading-6 text-slate-700">
      <li><strong>1.</strong> Abra esta página no Chrome ou Edge.</li>
      <li><strong>2.</strong> Use o ícone de instalação na barra de endereço ou o menu do navegador.</li>
      <li><strong>3.</strong> Confirme para criar o aplicativo no computador.</li>
    </ol>
  );
}

export function PwaInstallPage({
  appName,
  appShortName,
  backgroundColor,
  iconUrl,
  themeColor,
}: PwaInstallPageProps) {
  const [phase, setPhase] = useState<InstallPhase>("checking");
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const actionTextColor = useMemo(() => getReadableTextColor(themeColor), [themeColor]);
  const pageStyle = useMemo(
    () =>
      ({
        "--install-primary": themeColor,
        "--install-background": backgroundColor,
        backgroundColor: "var(--install-background)",
      }) as CSSProperties,
    [backgroundColor, themeColor],
  );

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const detectedPlatform = detectInstallPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    );
    const platformTimer = window.setTimeout(() => {
      setPlatform(detectedPlatform);
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
      return () => {
        window.clearTimeout(platformTimer);
      };
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setPhase("available");
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setPhase("installed");
    };
    const handleDisplayModeChange = () => {
      updateStandaloneState();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener?.("change", handleDisplayModeChange);

    const fallbackTimer = window.setTimeout(() => {
      setPhase((current) => (current === "checking" ? "unavailable" : current));
    }, 1500);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(platformTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPrompt) {
      setPhase("unavailable");
      return;
    }

    setPhase("prompting");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setPhase(choice.outcome === "accepted" ? "accepted" : "unavailable");
    } catch {
      setInstallPrompt(null);
      setPhase("unavailable");
    }
  }, [installPrompt]);

  const showManualInstructions = phase === "unavailable";
  const appInitial =
    appShortName.trim().charAt(0).toUpperCase() ||
    appName.trim().charAt(0).toUpperCase() ||
    "A";

  return (
    <main className="min-h-dvh px-5 py-8 text-slate-950" style={pageStyle}>
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/95 p-6 text-center shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
          <div className="mx-auto mb-5 grid size-24 place-items-center overflow-hidden rounded-[1.75rem] bg-slate-100 shadow-lg shadow-slate-900/15">
            {iconUrl ? (
              <Image
                alt={`Ícone ${appName}`}
                className="size-full object-cover"
                height={96}
                priority
                src={iconUrl}
                unoptimized
                width={96}
              />
            ) : (
              <span className="text-4xl font-black" style={{ color: themeColor }}>
                {appInitial}
              </span>
            )}
          </div>

          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Aplicativo oficial
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Instale {appShortName || appName}
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            Acesso rápido pela tela inicial, com a experiência segura do PWA. Nenhum APK é baixado.
          </p>

          <div aria-live="polite" className="mt-7 rounded-2xl bg-slate-50 p-5">
            {phase === "checking" ? (
              <>
                <div
                  className="mx-auto size-8 animate-spin rounded-full border-4 border-slate-200"
                  style={{ borderTopColor: themeColor }}
                />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Verificando a instalação disponível…
                </p>
              </>
            ) : null}

            {phase === "available" || phase === "prompting" ? (
              <>
                <p className="text-base font-black text-slate-900">Pronto para instalar</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  O navegador oferecerá a confirmação nativa. A instalação só acontece com sua autorização.
                </p>
                <button
                  className="mt-5 w-full rounded-2xl px-5 py-3.5 text-base font-black shadow-lg transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-70"
                  disabled={phase === "prompting"}
                  onClick={requestInstall}
                  style={{ backgroundColor: themeColor, color: actionTextColor }}
                  type="button"
                >
                  {phase === "prompting" ? "Aguardando confirmação…" : "Instalar aplicativo"}
                </button>
              </>
            ) : null}

            {phase === "accepted" ? (
              <>
                <p className="text-base font-black text-emerald-800">Instalação autorizada</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Conclua a confirmação do navegador. Depois, abra {appShortName || appName} pelo ícone criado.
                </p>
              </>
            ) : null}

            {phase === "installed" ? (
              <>
                <p className="text-base font-black text-emerald-800">Aplicativo instalado</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  O ícone já pode ser usado para abrir {appShortName || appName}.
                </p>
              </>
            ) : null}

            {phase === "standalone" ? (
              <>
                <p className="text-base font-black text-emerald-800">Aplicativo já instalado</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Você já está usando a versão instalada.
                </p>
                <Link
                  className="mt-5 block w-full rounded-2xl px-5 py-3.5 text-base font-black shadow-lg transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-slate-200"
                  href="/"
                  style={{ backgroundColor: themeColor, color: actionTextColor }}
                >
                  Abrir aplicativo
                </Link>
              </>
            ) : null}

            {showManualInstructions ? (
              <>
                <p className="text-base font-black text-slate-900">Instalação pelo navegador</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  O prompt automático não está disponível agora. Isso pode ocorrer quando o app já foi instalado ou quando o navegador ainda não liberou a opção.
                </p>
                {platform === "ios" ? <IosInstructions /> : null}
                {platform === "android" ? <AndroidInstructions /> : null}
                {platform === "desktop" ? <DesktopInstructions /> : null}
                {platform === "other" ? (
                  <p className="mt-5 text-sm font-medium leading-6 text-slate-700">
                    Abra esta página no Chrome, Edge ou Safari e use a opção de adicionar à tela inicial.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {phase !== "standalone" ? (
            <Link
              className="mt-6 inline-flex text-sm font-bold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
              href="/"
            >
              Continuar sem instalar
            </Link>
          ) : null}

          <p className="mt-5 text-xs font-medium leading-5 text-slate-400">
            A instalação utiliza os recursos oficiais do navegador e pode ser cancelada a qualquer momento.
          </p>
        </div>
      </section>
    </main>
  );
}
