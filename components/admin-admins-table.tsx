"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminListItem } from "@/lib/admin-directory.server";

type AdminAdminsTableProps = {
  admins: AdminListItem[];
  tenantDomains: string[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminAdminsTable({ admins, tenantDomains }: AdminAdminsTableProps) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorByAdmin, setErrorByAdmin] = useState<Record<string, string>>({});

  async function updateAdmin(adminId: string, update: Record<string, unknown>) {
    setPendingKey(adminId);
    setErrorByAdmin((current) => ({ ...current, [adminId]: "" }));

    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setErrorByAdmin((current) => ({
          ...current,
          [adminId]: result?.error || "Nao foi possivel atualizar.",
        }));
        return;
      }

      router.refresh();
    } catch {
      setErrorByAdmin((current) => ({
        ...current,
        [adminId]: "Nao foi possivel conectar com a API.",
      }));
    } finally {
      setPendingKey(null);
    }
  }

  async function toggleTenantAccess(adminId: string, tenantDomain: string, active: boolean) {
    const key = `${adminId}:${tenantDomain}`;
    setPendingKey(key);
    setErrorByAdmin((current) => ({ ...current, [adminId]: "" }));

    try {
      const response = await fetch(`/api/admin/admins/${adminId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantDomain, active }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setErrorByAdmin((current) => ({
          ...current,
          [adminId]: result?.error || "Nao foi possivel atualizar o acesso.",
        }));
        return;
      }

      router.refresh();
    } catch {
      setErrorByAdmin((current) => ({
        ...current,
        [adminId]: "Nao foi possivel conectar com a API.",
      }));
    } finally {
      setPendingKey(null);
    }
  }

  if (admins.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum administrador cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {admins.map((admin) => {
        const accessByDomain = new Map(
          admin.tenantAccess.map((item) => [item.tenantDomain, item.active]),
        );

        return (
          <div
            className="grid gap-3 rounded-lg border border-slate-100 p-4"
            key={admin.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {admin.name || admin.email}
                </p>
                <p className="text-sm text-slate-500">
                  {admin.email} • criado em {formatDate(admin.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-slate-400"
                  disabled={pendingKey === admin.id}
                  onChange={(event) => updateAdmin(admin.id, { role: event.target.value })}
                  value={admin.role}
                >
                  <option value="admin">admin</option>
                  <option value="super_admin">super_admin</option>
                </select>

                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    checked={admin.active}
                    disabled={pendingKey === admin.id}
                    onChange={(event) =>
                      updateAdmin(admin.id, { active: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Ativo
                </label>
              </div>
            </div>

            {admin.role === "admin" ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  Acesso por tenant
                </p>
                {tenantDomains.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum tenant_domain encontrado em app_settings.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tenantDomains.map((domain) => {
                      const key = `${admin.id}:${domain}`;
                      const active = accessByDomain.get(domain) || false;

                      return (
                        <label
                          className="flex items-center gap-2 text-sm font-normal text-slate-700"
                          key={domain}
                        >
                          <input
                            checked={active}
                            disabled={pendingKey === key}
                            onChange={(event) =>
                              toggleTenantAccess(admin.id, domain, event.target.checked)
                            }
                            type="checkbox"
                          />
                          {domain}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                super_admin acessa todos os tenants automaticamente.
              </p>
            )}

            {errorByAdmin[admin.id] ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {errorByAdmin[admin.id]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
