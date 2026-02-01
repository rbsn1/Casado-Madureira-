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
  const { data: profile, error: roleError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .returns<{ role: string }>()
    .maybeSingle();

  if (roleError || profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { user: data.user };
}
