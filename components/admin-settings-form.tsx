"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { AppSettings } from "@/lib/app-settings";

type AdminSettingsFormProps = {
  initialSettings: AppSettings;
};

type SaveStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

const textFields = [
  ["appName", "Nome do app"],
  ["appShortName", "Nome curto"],
  ["appDescription", "Descricao"],
  ["platformUrl", "URL da plataforma"],
  ["supportUrl", "URL de suporte"],
  ["publicUrl", "URL publica"],
  ["logoUrl", "URL do logo"],
  ["icon192Url", "URL do icone 192"],
  ["icon512Url", "URL do icone 512"],
  ["faviconUrl", "URL do favicon"],
  ["splashTitle", "Titulo da splash"],
  ["splashMessage", "Mensagem da splash"],
] as const;

export function AdminSettingsForm({ initialSettings }: AdminSettingsFormProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "",
  });
  const appInitial =
    settings.appShortName.trim().charAt(0).toUpperCase() ||
    settings.appName.trim().charAt(0).toUpperCase() ||
    "A";

  const previewStyle = useMemo(
    () => ({
      backgroundColor: settings.backgroundColor || "#f6f7fb",
      color: "#0f172a",
    }),
    [settings.backgroundColor],
  );

  function updateField<Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings() {
    setStatus({ type: "loading", message: "Salvando configuracoes..." });

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setStatus({
        type: "error",
        message: result?.error || "Nao foi possivel salvar.",
      });
      return;
    }

    setSettings(result.settings);
    setStatus({
      type: "success",
      message: "Configuracoes salvas com sucesso.",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {textFields.map(([key, label]) => (
            <label className="grid gap-2 text-sm font-semibold text-slate-700" key={key}>
              {label}
              <input
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
                onChange={(event) => updateField(key, event.target.value)}
                type="text"
                value={settings[key]}
              />
            </label>
          ))}

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Cor principal
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
              onChange={(event) => updateField("themeColor", event.target.value)}
              type="text"
              value={settings.themeColor}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Cor de fundo
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
              onChange={(event) =>
                updateField("backgroundColor", event.target.value)
              }
              type="text"
              value={settings.backgroundColor}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Tempo de redirecionamento (ms)
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
              min={0}
              onChange={(event) =>
                updateField("redirectDelayMs", Number(event.target.value))
              }
              type="number"
              value={settings.redirectDelayMs}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            OneSignal App ID
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
              onChange={(event) =>
                updateField("oneSignalAppId", event.target.value)
              }
              type="text"
              value={settings.oneSignalAppId}
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              checked={settings.notificationsEnabled}
              className="size-4"
              onChange={(event) =>
                updateField("notificationsEnabled", event.target.checked)
              }
              type="checkbox"
            />
            Notificacoes ativas
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="min-h-11 rounded-lg px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status.type === "loading"}
            onClick={saveSettings}
            style={{ backgroundColor: settings.themeColor || "#101828" }}
            type="button"
          >
            {status.type === "loading" ? "Salvando..." : "Salvar configuracoes"}
          </button>

          {status.message ? (
            <p
              className={
                status.type === "error"
                  ? "text-sm font-semibold text-red-700"
                  : "text-sm font-semibold text-emerald-700"
              }
            >
              {status.message}
            </p>
          ) : null}
        </div>
      </section>

      <aside className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black">Previa da splash</h2>
        <div
          className="grid min-h-96 place-items-center rounded-lg px-5 py-8 text-center"
          style={previewStyle}
        >
          <div className="flex max-w-xs flex-col items-center">
            {settings.logoUrl ? (
              <Image
                alt={`${settings.appName} logo`}
                className="size-20 rounded-3xl object-cover shadow-xl shadow-slate-900/15"
                height={80}
                src={settings.logoUrl}
                unoptimized
                width={80}
              />
            ) : (
              <div
                className="grid size-20 place-items-center rounded-3xl text-3xl font-bold text-white shadow-xl shadow-slate-900/15"
                style={{ backgroundColor: settings.themeColor || "#101828" }}
              >
                {appInitial}
              </div>
            )}

            <h3 className="mt-6 text-2xl font-bold tracking-normal">
              {settings.splashTitle || settings.appName}
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {settings.splashMessage || "Carregando ambiente seguro..."}
            </p>
            <div
              aria-hidden="true"
              className="mt-7 size-9 rounded-full border-4 border-slate-200"
              style={{ borderTopColor: settings.themeColor || "#101828" }}
            />
            <button
              className="mt-8 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15"
              style={{ backgroundColor: settings.themeColor || "#101828" }}
              type="button"
            >
              Abrir agora
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
