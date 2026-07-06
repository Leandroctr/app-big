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

function mapAdminUserRow(row: AdminUserRow): AdminListItem {
  return {
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
  };
}

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

  return ((data || []) as AdminUserRow[]).map(mapAdminUserRow);
}

// Usado pelo fluxo de "vincular usuario existente" (POST /api/admin/admins
// com senha vazia): confirma se um auth_user_id ja tem linha em admin_users
// antes de decidir entre vincular ou recusar com 409.
export async function getAdminUserByAuthId(
  authUserId: string,
): Promise<AdminListItem | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select(
      "id, auth_user_id, email, name, role, active, created_at, admin_tenant_access(tenant_domain, active)",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle<AdminUserRow>();

  if (error) {
    logServerError("admin_directory_get_by_auth_id_error", error, { authUserId });
    return null;
  }

  return data ? mapAdminUserRow(data) : null;
}

export type AuthUserLookup = {
  id: string;
  email: string;
};

// Supabase Admin API nao expõe um "getUserByEmail" direto — a busca precisa
// paginar auth.admin.listUsers(). Premissa de baixo volume de contas Auth
// neste projeto (paineis administrativos internos, sem cadastro publico):
// limitamos a varredura a algumas paginas grandes. Se o numero de contas
// Auth crescer muito além disso no futuro, este helper precisa de revisão
// (ex.: RPC dedicada ou índice/cache local).
const LIST_USERS_PAGE_SIZE = 200;
const LIST_USERS_MAX_PAGES = 10;

export async function findAuthUserByEmail(
  email: string,
): Promise<AuthUserLookup | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      logServerError("admin_directory_find_auth_user_error", error, { page });
      return null;
    }

    const match = data.users.find(
      (user) => (user.email || "").trim().toLowerCase() === normalizedEmail,
    );

    if (match) {
      return { id: match.id, email: match.email || normalizedEmail };
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) {
      break;
    }
  }

  return null;
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
