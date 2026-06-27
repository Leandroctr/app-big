import { NextResponse } from "next/server";
import { getFallbackAppSettings, settingsRowToAppSettings, extractHostname } from "@/lib/app-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "env",
      settings: getFallbackAppSettings(),
    });
  }

  const hostname = extractHostname(appConfig.publicUrl);
  console.log("[api/settings] buscando tenant_domain:", hostname);

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("tenant_domain", hostname)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ok: true,
      source: "env",
      settings: getFallbackAppSettings(),
    });
  }

  return NextResponse.json({
    ok: true,
    source: data ? "database" : "env",
    settings: settingsRowToAppSettings(data),
  });
}
