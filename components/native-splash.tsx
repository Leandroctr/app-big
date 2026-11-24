"use client";

import Image from "next/image";
import { useState, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import styles from "./native-splash.module.css";

type NativeSplashProps = {
  appName: string;
  logoUrl: string;
  iconUrl: string;
  splashImageUrl: string;
  themeColor: string;
  backgroundColor: string;
  splashTitle: string;
  splashMessage: string;
  openUrl?: string;
  supportUrl: string;
  hasPlatformError: boolean;
  onOpen: MouseEventHandler<HTMLAnchorElement>;
  children?: ReactNode;
};

function imageSource(value: string) {
  const source = value.trim();
  return /^(?:https:\/\/|\/(?![/\\]))/i.test(source) ? source : "";
}

function themeColor(value: string, fallback: string) {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) ? value : fallback;
}

function SplashMark({ logo, icon, appName }: { logo: string; icon: string; appName: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = [logo, icon].find((candidate) => candidate && !failed.includes(candidate));
  return (
    <div className={styles.mark}>
      {source ? (
        <Image
          alt={"Logotipo de " + appName}
          className={styles.logo}
          height={160}
          loading="eager"
          onError={() => setFailed((previous) => [...previous, source])}
          src={source}
          unoptimized
          width={160}
        />
      ) : (
        <span aria-hidden="true">{appName.trim().charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

export function NativeSplash({
  appName, logoUrl, iconUrl, splashImageUrl, themeColor: accent, backgroundColor,
  splashTitle, splashMessage, openUrl, supportUrl, hasPlatformError, onOpen, children,
}: NativeSplashProps) {
  const artwork = imageSource(splashImageUrl);
  const logo = imageSource(logoUrl);
  const icon = imageSource(iconUrl);
  const style = {
    "--splash-accent": themeColor(accent, "#1683ab"),
    "--splash-base": themeColor(backgroundColor, "#f6f7fb"),
  } as CSSProperties;

  return (
    <main className={styles.splash} style={style}>
      <div aria-hidden="true" className={styles.atmosphere}>
        {artwork && (
          <Image alt="" className={styles.artwork} fill sizes="100vw" src={artwork} unoptimized />
        )}
      </div>

      <section aria-labelledby="splash-title" className={styles.content}>
        <div className={styles.emblem}>
          <SplashMark key={logo + "|" + icon} logo={logo} icon={icon} appName={appName} />
        </div>

        <div className={styles.copy}>
          <h1 id="splash-title">{splashTitle.trim() || appName}</h1>
          <p role="status">
            {hasPlatformError
              ? "Não foi possível abrir a plataforma automaticamente."
              : splashMessage.trim() || "Carregando ambiente seguro..."}
          </p>
        </div>

        {!hasPlatformError && (
          <div aria-hidden="true" className={styles.loading}>
            <span /><span /><span />
          </div>
        )}

        {hasPlatformError && <p className={styles.error}>O endereço da plataforma ainda não foi configurado.</p>}

        <div className={styles.actions}>
          {openUrl ? (
            <a className={styles.primary} href={openUrl} onClick={onOpen}>Abrir agora</a>
          ) : (
            <button className={styles.primary} disabled type="button">Abrir agora</button>
          )}
          <a className={styles.support} href={supportUrl || "#"}>Suporte</a>
          {children}
        </div>
      </section>
    </main>
  );
}
