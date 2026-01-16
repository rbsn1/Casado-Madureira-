import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase anon env vars are missing.");
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("usuarios_perfis")
    .select("role, active")
    .eq("user_id", data.user.id)
    .eq("active", true);

  const typedRoles = (roles ?? []) as { role: string }[];
  if (roleError || !typedRoles.some((item) => item.role === "ADMIN_MASTER")) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { user: data.user };
}
