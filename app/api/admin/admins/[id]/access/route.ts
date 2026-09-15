import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import { listTenantDomains } from "@/lib/admin-directory.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logServerError, logServerInfo } from "@/lib/logger/server";
import { sanitizeTenantGrantAuditMetadata } from "@/lib/admin-audit";
import {
  AdminAuditUnavailableError,
  beginAdminAudit,
  completeAdminAudit,
} from "@/lib/admin-audit.server";

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

  const { data: previousAccess, error: previousAccessError } = await supabase
    .from("admin_tenant_access")
    .select("active")
    .eq("admin_user_id", id)
    .eq("tenant_domain", tenantDomain)
    .maybeSingle();

  if (previousAccessError) {
    logServerError("admin_tenant_access_lookup_error", previousAccessError, {
      adminUserId: id,
      tenantDomain,
    });
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel validar o acesso atual." },
      { status: 500 },
    );
  }

  const previousActive =
    typeof previousAccess?.active === "boolean" ? previousAccess.active : null;
  const auditMetadata = sanitizeTenantGrantAuditMetadata({
    previousActive,
    currentActive: active,
  });
  let auditContext;

  try {
    auditContext = await beginAdminAudit({
      actor: currentAdmin,
      action: active ? "admin.tenant_granted" : "admin.tenant_revoked",
      entityType: "admin_tenant_access",
      entityId: id,
      targetTenantDomain: tenantDomain,
      metadataJson: auditMetadata,
    });
  } catch (error) {
    if (error instanceof AdminAuditUnavailableError) {
      return NextResponse.json(
        { ok: false, error: "Auditoria administrativa indisponivel." },
        { status: 503 },
      );
    }
    throw error;
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
    await completeAdminAudit(auditContext, {
      outcome: "failure",
      metadataJson: sanitizeTenantGrantAuditMetadata({
        previousActive,
        currentActive: previousActive,
      }),
    });
    logServerError("admin_tenant_access_update_error", error, {
      adminUserId: id,
      tenantDomain,
    });
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel atualizar o acesso ao tenant." },
      { status: 500 },
    );
  }

  await completeAdminAudit(auditContext, {
    outcome: "success",
    metadataJson: sanitizeTenantGrantAuditMetadata({
      previousActive,
      currentActive: data.active,
    }),
  });

  logServerInfo("admin_tenant_access_updated", { adminUserId: id, tenantDomain, active });

  return NextResponse.json({
    ok: true,
    access: {
      tenantDomain: data.tenant_domain,
      active: data.active,
    },
  });
}
