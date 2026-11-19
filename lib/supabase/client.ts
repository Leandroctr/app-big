import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

type SupabaseBrowserClientOptions = {
  detectSessionInUrl?: boolean;
};

export function createSupabaseBrowserClient(
  options: SupabaseBrowserClientOptions = {},
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      detectSessionInUrl: options.detectSessionInUrl ?? true,
    },
  });
}
