"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appConfig } from "@/lib/app-config";

type AdminAdminsFormProps = {
  tenantDomains: string[];
};

type FormStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

export function AdminAdminsForm({ tenantDomains }: AdminAdminsFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ type: "idle", message: "" });

  function toggleTenant(domain: string) {
    setSelectedTenants((current) =>
      current.includes(domain)
        ? current.filter((item) => item !== domain)
        : [...current, domain],
    );
  }

  async function createAdmin(formData: FormData) {
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      setStatus({ type: "error", message: "Preencha e-mail e senha." });
      return;
    }

    setIsSaving(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          role,
          password,
          tenantDomains: role === "admin" ? selectedTenants : [],
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setStatus({
          type: "error",
          message: result?.error || "Nao foi possivel criar o administrador.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: result.warning || `Administrador ${email} criado com sucesso.`,
      });
      setSelectedTenants([]);
      setRole("admin");
      router.refresh();
    } catch {
      setStatus({ type: "error", message: "Nao foi possivel conectar com a API." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form action={createAdmin} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-base font-normal text-slate-950 outline-none focus:border-slate-400"
            disabled={isSaving}
            name="email"
            required
            type="email"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Nome
          <input
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-base font-normal text-slate-950 outline-none focus:border-slate-400"
            disabled={isSaving}
            name="name"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Senha inicial
          <input
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-base font-normal text-slate-950 outline-none focus:border-slate-400"
            disabled={isSaving}
            minLength={12}
            name="password"
            required
            type="password"
          />
          <span className="text-xs font-normal text-slate-500">
            Minimo 12 caracteres. Sem senhas genericas (123456, admin, etc.).
          </span>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Papel
          <select
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-base font-normal text-slate-950 outline-none focus:border-slate-400"
            disabled={isSaving}
            onChange={(event) => setRole(event.target.value as "admin" | "super_admin")}
            value={role}
          >
            <option value="admin">admin</option>
            <option value="super_admin">super_admin</option>
          </select>
        </label>
      </div>

      {role === "admin" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-slate-700">
            Tenants liberados
          </legend>
          {tenantDomains.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum tenant_domain encontrado em app_settings.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {tenantDomains.map((domain) => (
                <label
                  className="flex items-center gap-2 text-sm font-normal text-slate-700"
                  key={domain}
                >
                  <input
                    checked={selectedTenants.includes(domain)}
                    disabled={isSaving}
                    onChange={() => toggleTenant(domain)}
                    type="checkbox"
                  />
                  {domain}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-slate-500">
          super_admin acessa todos os tenants automaticamente.
        </p>
      )}

      <button
        className="min-h-12 w-fit rounded-lg px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving}
        style={{ backgroundColor: appConfig.themeColor }}
        type="submit"
      >
        {isSaving ? "Criando..." : "Criar administrador"}
      </button>

      {status.message ? (
        <p
          className={
            status.type === "success"
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
              : "rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          }
        >
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
