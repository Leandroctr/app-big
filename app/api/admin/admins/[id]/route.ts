import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logServerError, logServerInfo } from "@/lib/logger/server";

type UpdateAdminPayload = {
  role?: string;
  active?: boolean;
  name?: string;
};

const forbiddenResponse = NextResponse.json(
  { ok: false, error: "Acesso restrito a super administradores." },
  { status: 403 },
);

function isValidRole(role: unknown): role is "super_admin" | "admin" {
  return role === "super_admin" || role === "admin";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  const { id } = await context.params;

  let payload: UpdateAdminPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload invalido." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (payload.role !== undefined) {
    if (!isValidRole(payload.role)) {
      return NextResponse.json(
        { ok: false, error: "Papel invalido. Use super_admin ou admin." },
        { status: 400 },
      );
    }
    update.role = payload.role;
  }

  if (payload.active !== undefined) {
    update.active = Boolean(payload.active);
  }

  if (payload.name !== undefined) {
    update.name = String(payload.name).trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
  }

  // Trava de seguranca: evita que um super_admin se desative ou se
  // rebaixe por engano, o que poderia travar o acesso de todo mundo caso
  // ele seja o unico super_admin existente.
  const isSelf = id === currentAdmin.id;

  if (isSelf && (update.active === false || update.role === "admin")) {
    return NextResponse.json(
      { ok: false, error: "Nao e possivel desativar ou rebaixar a propria conta." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("admin_users")
    .update(update)
    .eq("id", id)
    .select("id, auth_user_id, email, name, role, active, created_at")
    .maybeSingle();

  if (error || !data) {
    logServerError("admin_update_error", error, { adminUserId: id });
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel atualizar o administrador." },
      { status: 500 },
    );
  }

  logServerInfo("admin_updated", { adminUserId: id, update });

  return NextResponse.json({
    ok: true,
    admin: {
      id: data.id,
      authUserId: data.auth_user_id,
      email: data.email,
      name: data.name,
      role: data.role,
      active: data.active,
      createdAt: data.created_at,
    },
  });
}
