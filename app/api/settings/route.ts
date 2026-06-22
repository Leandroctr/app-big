import { NextResponse } from "next/server";
import { getFallbackAppSettings, settingsRowToAppSettings } from "@/lib/app-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
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
