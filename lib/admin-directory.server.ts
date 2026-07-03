import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/logger/server";
import type { AdminRole } from "@/lib/admin-identity.server";

// Leituras auxiliares para a tela "Administradores". Depende das tabelas
// admin_users/admin_tenant_access (migration 003) — enquanto ela nao for
// aplicada, estas funcoes retornam listas vazias (erro logado, nao lancado),
// seguindo o mesmo padrao de fallback silencioso ja usado em
// lib/app-settings.server.ts.

export type AdminTenantAccessItem = {
  tenantDomain: string;
  active: boolean;
};

export type AdminListItem = {
  id: string;
  authUserId: string;
  email: string;
  name: string | null;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  tenantAccess: AdminTenantAccessItem[];
};

type AdminUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  active: boolean;
  created_at: string;
  admin_tenant_access: { tenant_domain: string; active: boolean }[] | null;
};

export async function listAdminUsers(): Promise<AdminListItem[]> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select(
      "id, auth_user_id, email, name, role, active, created_at, admin_tenant_access(tenant_domain, active)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("admin_directory_list_admins_error", error);
    return [];
  }

  return ((data || []) as AdminUserRow[]).map((row) => ({
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    tenantAccess: (row.admin_tenant_access || []).map((item) => ({
      tenantDomain: item.tenant_domain,
      active: item.active,
    })),
  }));
}

export async function listTenantDomains(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("tenant_domain")
    .not("tenant_domain", "is", null)
    .order("tenant_domain", { ascending: true });

  if (error) {
    logServerError("admin_directory_list_tenants_error", error);
    return [];
  }

  return ((data || []) as { tenant_domain: string | null }[])
    .map((row) => row.tenant_domain)
    .filter((domain): domain is string => Boolean(domain));
}
