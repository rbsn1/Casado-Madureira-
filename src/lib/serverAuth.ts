import "server-only";
import { createClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";
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

async function requireAuthenticatedUser(request: Request): Promise<
  | { error: NextResponse }
  | {
      user: User;
    }
> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  return { user: data.user };
}

export async function requireAdmin(request: Request) {
  const authUser = await requireAuthenticatedUser(request);
  if ("error" in authUser) return authUser;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: roleError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUser.user.id)
    .maybeSingle();

  const profileRole = (profile as { role?: string } | null)?.role;
  if (!roleError && profileRole === "admin") {
    return { user: authUser.user };
  }

  const { data: adminRoles, error: adminRoleError } = await supabaseAdmin
    .from("usuarios_perfis")
    .select("role, active")
    .eq("user_id", authUser.user.id)
    .in("role", ["ADMIN_MASTER", "SUPER_ADMIN"])
    .eq("active", true);

  if (adminRoleError || !adminRoles?.length) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { user: authUser.user };
}

export async function requireDiscipuladoAdmin(request: Request) {
  const authUser = await requireAuthenticatedUser(request);
  if ("error" in authUser) return authUser;

  const supabaseAdmin = getSupabaseAdmin();
  let { data: activeRoles, error: rolesError } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("role, congregation_id")
    .eq("user_id", authUser.user.id)
    .eq("active", true);

  if (rolesError?.message?.toLowerCase().includes("congregation_id")) {
    // Legacy schema fallback: some environments still don't have congregation_id.
    const fallback = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .select("role")
      .eq("user_id", authUser.user.id)
      .eq("active", true);
    activeRoles = fallback.data;
    rolesError = fallback.error;
  }

  if (rolesError) {
    return { error: NextResponse.json({ error: rolesError.message }, { status: 500 }) };
  }

  const roles = ((activeRoles ?? []) as { role: string; congregation_id?: string | null }[]).map(
    (item) => item.role
  );
  const adminDiscipuladoRole = ((activeRoles ?? []) as { role: string; congregation_id?: string | null }[]).find(
    (item) => item.role === "ADMIN_DISCIPULADO" && Boolean(item.congregation_id)
  );

  if (!roles.includes("ADMIN_DISCIPULADO")) {
    return {
      error: NextResponse.json(
        { error: "Acesso restrito ao perfil ADMIN_DISCIPULADO." },
        { status: 403 }
      )
    };
  }

  const congregationId = adminDiscipuladoRole?.congregation_id
    ? String(adminDiscipuladoRole.congregation_id)
    : null;

  return {
    user: authUser.user,
    isGlobalAdmin: congregationId === null,
    congregationId
  };
}
