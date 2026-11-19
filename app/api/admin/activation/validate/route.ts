import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AdminActivationRow = {
  role: unknown;
  active: boolean;
};

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/.exec(authorization);
  const token = match?.[1] || "";

  return token.length > 0 && token.length <= 8192 ? token : null;
}

function isAdminRole(role: unknown) {
  return role === "super_admin" || role === "admin";
}

export async function POST(request: Request) {
  const accessToken = extractBearerToken(request);

  if (!accessToken) {
    return json({ ok: false }, 401);
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return json({ ok: false }, 503);
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !userData.user?.email) {
    return json({ ok: false }, 401);
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("role, active")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle<AdminActivationRow>();

  if (adminError) {
    return json({ ok: false }, 503);
  }

  if (!admin || !admin.active || !isAdminRole(admin.role)) {
    return json({ ok: false }, 403);
  }

  return json({ ok: true, email: userData.user.email }, 200);
}
