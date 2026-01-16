import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const hasValidUrl = isValidHttpUrl(supabaseUrl);

if (!hasValidUrl || !supabaseAnonKey) {
  console.warn("Supabase URL/Key inválidos. Configure variáveis de ambiente para uso real.");
}

export const supabaseClient = hasValidUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
