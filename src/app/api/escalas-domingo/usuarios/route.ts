import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deriveUserDisplayName,
  SUNDAY_SCALE_LEADERSHIP_ROLES,
  SUNDAY_SCALE_PORTAL_ROLES
} from "@/lib/sundayServiceScale";

export const runtime = "nodejs";

type ActiveRole = {
  user_id?: string | null;
  role: string;
  congregation_id?: string | null;
};

async function hasCongregationColumn() {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("congregation_id")
    .limit(1);
  return !error;
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hasCongregationId = await hasCongregationColumn();
  const roleSelect = hasCongregationId ? "role, congregation_id" : "role";
  const { data: rawRoles, error: rolesError } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select(roleSelect)
    .eq("user_id", authData.user.id)
    .eq("active", true);

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  const activeRoles = (rawRoles ?? []) as ActiveRole[];
  const roleNames = activeRoles.map((item) => item.role);
  const hasLeadershipAccess = roleNames.some((role) =>
    SUNDAY_SCALE_LEADERSHIP_ROLES.includes(
      role as (typeof SUNDAY_SCALE_LEADERSHIP_ROLES)[number]
    )
  );

  if (!hasLeadershipAccess) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ownCongregation =
    activeRoles.find((item) => item.congregation_id)?.congregation_id ?? null;
  if (!ownCongregation) {
    return NextResponse.json(
      { error: "Usuário sem congregação ativa para montar a escala." },
      { status: 400 }
    );
  }

  const search = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { data: eligibleRoles, error: eligibleError } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("user_id, role, congregation_id")
    .eq("active", true)
    .eq("congregation_id", ownCongregation)
    .in("role", Array.from(SUNDAY_SCALE_PORTAL_ROLES));

  if (eligibleError) {
    return NextResponse.json({ error: eligibleError.message }, { status: 500 });
  }

  const grouped = new Map<string, string[]>();
  for (const row of (eligibleRoles ?? []) as ActiveRole[]) {
    const userId = row.user_id ?? null;
    if (!userId) continue;
    grouped.set(userId, [...(grouped.get(userId) ?? []), row.role]);
  }

  const userIds = Array.from(grouped.keys());
  if (!userIds.length) {
    return NextResponse.json({ users: [] });
  }

  const { data: contacts } = await (supabaseAdmin as any)
    .from("user_contacts")
    .select("user_id, whatsapp")
    .in("user_id", userIds);

  const contactByUser = new Map(
    ((contacts ?? []) as Array<{ user_id: string; whatsapp: string | null }>).map(
      (item) => [item.user_id, item.whatsapp]
    )
  );

  const users = await Promise.all(
    userIds.map(async (userId) => {
      const result = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = result.data.user?.email ?? null;
      const metadata = (result.data.user?.user_metadata ?? null) as Record<string, unknown> | null;
      return {
        id: userId,
        name: deriveUserDisplayName(email, metadata),
        email,
        whatsapp: contactByUser.get(userId) ?? null,
        roles: grouped.get(userId) ?? []
      };
    })
  );

  const filtered = users
    .filter((item) => {
      if (!search) return true;
      const haystack = `${item.name} ${item.email ?? ""} ${item.whatsapp ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return NextResponse.json({ users: filtered });
}
