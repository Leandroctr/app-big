import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import { listTenantDomains } from "@/lib/admin-directory.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logServerError, logServerInfo } from "@/lib/logger/server";

type UpdateAccessPayload = {
  tenantDomain?: string;
  active?: boolean;
};

const forbiddenResponse = NextResponse.json(
  { ok: false, error: "Acesso restrito a super administradores." },
  { status: 403 },
);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  const { id } = await context.params;

  let payload: UpdateAccessPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload invalido." }, { status: 400 });
  }

  const tenantDomain = String(payload.tenantDomain || "").trim();
  const active = Boolean(payload.active);

  if (!tenantDomain) {
    return NextResponse.json({ ok: false, error: "tenantDomain e obrigatorio." }, { status: 400 });
  }

  const validTenantDomains = await listTenantDomains();

  if (!validTenantDomains.includes(tenantDomain)) {
    return NextResponse.json(
      { ok: false, error: "Esse tenant_domain nao existe em app_settings." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("admin_tenant_access")
    .upsert(
      { admin_user_id: id, tenant_domain: tenantDomain, active },
      { onConflict: "admin_user_id,tenant_domain" },
    )
    .select("id, admin_user_id, tenant_domain, active")
    .single();

  if (error || !data) {
    logServerError("admin_tenant_access_update_error", error, {
      adminUserId: id,
      tenantDomain,
    });
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel atualizar o acesso ao tenant." },
      { status: 500 },
    );
  }

  logServerInfo("admin_tenant_access_updated", { adminUserId: id, tenantDomain, active });

  return NextResponse.json({
    ok: true,
    access: {
      tenantDomain: data.tenant_domain,
      active: data.active,
    },
  });
}
