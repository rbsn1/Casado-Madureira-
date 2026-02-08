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
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUser.user.id)
    .maybeSingle();

  const profileRole = (profile as { role?: string } | null)?.role;
  const profileAdmin = !profileError && profileRole === "admin";

  const { data: activeRoles, error: rolesError } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("role, congregation_id")
    .eq("user_id", authUser.user.id)
    .eq("active", true);

  if (rolesError) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const roles = ((activeRoles ?? []) as { role: string; congregation_id?: string | null }[]).map(
    (item) => item.role
  );
  const isGlobalAdmin =
    profileAdmin || roles.includes("ADMIN_MASTER") || roles.includes("SUPER_ADMIN");

  if (isGlobalAdmin) {
    return {
      user: authUser.user,
      isGlobalAdmin: true,
      congregationId: null as string | null
    };
  }

  const discipuladoRole = ((activeRoles ?? []) as { role: string; congregation_id?: string | null }[]).find(
    (item) => item.role === "DISCIPULADOR" && Boolean(item.congregation_id)
  );

  if (!discipuladoRole?.congregation_id) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return {
    user: authUser.user,
    isGlobalAdmin: false,
    congregationId: String(discipuladoRole.congregation_id)
  };
}
