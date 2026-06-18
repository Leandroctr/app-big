import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/app-config";

export function createSupabaseBrowserClient() {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return null;
  }

  return createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
}
