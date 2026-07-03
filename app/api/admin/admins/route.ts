import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import { listAdminUsers, listTenantDomains } from "@/lib/admin-directory.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { checkPasswordPolicy } from "@/lib/password-policy";
import { logServerError, logServerInfo } from "@/lib/logger/server";

type CreateAdminPayload = {
  email?: string;
  name?: string;
  role?: string;
  password?: string;
  tenantDomains?: string[];
};

const forbiddenResponse = NextResponse.json(
  { ok: false, error: "Acesso restrito a super administradores." },
  { status: 403 },
);

function isValidRole(role: unknown): role is "super_admin" | "admin" {
  return role === "super_admin" || role === "admin";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET() {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  const [admins, tenantDomains] = await Promise.all([
    listAdminUsers(),
    listTenantDomains(),
  ]);

  return NextResponse.json({ ok: true, admins, tenantDomains });
}

export async function POST(request: Request) {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  let payload: CreateAdminPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload invalido." }, { status: 400 });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim() || null;
  const role = payload.role;
  const password = String(payload.password || "");
  const requestedTenantDomains = Array.isArray(payload.tenantDomains)
    ? payload.tenantDomains.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "E-mail invalido." }, { status: 400 });
  }

  if (!isValidRole(role)) {
    return NextResponse.json(
      { ok: false, error: "Papel invalido. Use super_admin ou admin." },
      { status: 400 },
    );
  }

  const passwordCheck = checkPasswordPolicy(password, { email, name: name || undefined });

  if (!passwordCheck.ok) {
    return NextResponse.json({ ok: false, error: passwordCheck.reason }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 503 });
  }

  // So aceita tenant_domain que de fato existe em app_settings — evita
  // conceder acesso a um dominio inexistente/digitado errado.
  const validTenantDomains = await listTenantDomains();
  const tenantDomains = requestedTenantDomains.filter((domain) =>
    validTenantDomains.includes(domain),
  );

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !createdUser?.user) {
    logServerError("admin_create_auth_user_error", createUserError, { email });
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel criar o usuario no Supabase Auth." },
      { status: 500 },
    );
  }

  const authUserId = createdUser.user.id;

  const { data: adminUserRow, error: adminUserError } = await supabase
    .from("admin_users")
    .insert({ auth_user_id: authUserId, email, name, role, active: true })
    .select("id, auth_user_id, email, name, role, active, created_at")
    .single();

  if (adminUserError || !adminUserRow) {
    logServerError("admin_create_admin_user_error", adminUserError, { email, authUserId });

    // Evita deixar um usuario orfao no Supabase Auth sem linha correspondente
    // em admin_users (ex.: tabela ainda nao existe — migration 003 pendente
    // — ou e-mail duplicado).
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(authUserId);

    if (cleanupError) {
      logServerError("admin_create_cleanup_error", cleanupError, { authUserId });
    }

    return NextResponse.json(
      { ok: false, error: "Nao foi possivel registrar o administrador." },
      { status: 500 },
    );
  }

  let tenantAccessWarning: string | undefined;

  if (role === "admin" && tenantDomains.length > 0) {
    const accessRows = tenantDomains.map((tenantDomain) => ({
      admin_user_id: adminUserRow.id,
      tenant_domain: tenantDomain,
      active: true,
    }));

    const { error: accessError } = await supabase.from("admin_tenant_access").insert(accessRows);

    if (accessError) {
      logServerError("admin_create_tenant_access_error", accessError, {
        adminUserId: adminUserRow.id,
      });
      tenantAccessWarning =
        "Administrador criado, mas nao foi possivel salvar o acesso aos tenants selecionados. Ajuste na tela de administradores.";
    }
  }

  logServerInfo("admin_created", { email, role, adminUserId: adminUserRow.id });

  return NextResponse.json({
    ok: true,
    admin: {
      id: adminUserRow.id,
      authUserId: adminUserRow.auth_user_id,
      email: adminUserRow.email,
      name: adminUserRow.name,
      role: adminUserRow.role,
      active: adminUserRow.active,
      createdAt: adminUserRow.created_at,
      tenantAccess:
        role === "admin"
          ? tenantDomains.map((tenantDomain) => ({ tenantDomain, active: true }))
          : [],
    },
    warning: tenantAccessWarning,
  });
}
