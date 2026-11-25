export const BRAND_NAME = "ചായപ്പുര";

/** Same singleton id as the web shop (`lib/constants.ts`). */
export const SHOP_SETTINGS_ID = "00000000-0000-4000-8000-000000000001";

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function assertSupabaseConfig(): void {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (same project as the shop web app)."
    );
  }
}