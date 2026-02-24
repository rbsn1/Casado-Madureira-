import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DISCIPULADO_ACCESS_ROLES = new Set([
  "ADMIN_DISCIPULADO",
  "DISCIPULADOR",
  "SM_DISCIPULADO",
  "SECRETARIA_DISCIPULADO"
]);
const ASSIGNEE_ROLES = ["DISCIPULADOR", "ADMIN_DISCIPULADO"];
const CONGREGATION_COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;
const ASSIGNEE_CACHE_TTL_MS = 60 * 1000;
const USER_EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;

type Assignee = {
  id: string;
  label: string;
};

type ActiveRole = {
  role: string;
  congregation_id?: string | null;
};

let congregationColumnCache: { value: boolean; expiresAt: number } | null = null;
const assigneeCache = new Map<string, { value: Assignee[]; expiresAt: number }>();
const userEmailCache = new Map<string, { value: string | null; expiresAt: number }>();

async function hasCongregationColumn() {
  const now = Date.now();
  if (congregationColumnCache && congregationColumnCache.expiresAt > now) {
    return congregationColumnCache.value;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await (supabaseAdmin as any).from("usuarios_perfis").select("congregation_id").limit(1);
  const value = !error;
  if (!value && error.message?.toLowerCase().includes("congregation_id")) {
    congregationColumnCache = { value: false, expiresAt: now + CONGREGATION_COLUMN_CACHE_TTL_MS };
    return false;
  }

  congregationColumnCache = { value, expiresAt: now + CONGREGATION_COLUMN_CACHE_TTL_MS };
  return value;
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
  let rolesQuery = (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select(hasCongregationId ? "role, congregation_id" : "role")
    .eq("user_id", authData.user.id)
    .eq("active", true);
  let { data: activeRoles, error: rolesError } = await rolesQuery;
  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  const normalizedRoles = (activeRoles ?? []) as ActiveRole[];
  const roleNames = normalizedRoles.map((item) => item.role);
  const hasAccess = roleNames.some((role) => DISCIPULADO_ACCESS_ROLES.has(role));
  if (!hasAccess) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const hasGlobalDiscipuladoAdmin = normalizedRoles.some(
    (item) => item.role === "ADMIN_DISCIPULADO" && !item.congregation_id
  );
  const hasGlobalAdmin = roleNames.includes("ADMIN_MASTER") || roleNames.includes("SUPER_ADMIN");
  const requestedCongregation = new URL(request.url).searchParams.get("congregationId")?.trim() || null;
  const ownCongregation =
    normalizedRoles.find((item) => DISCIPULADO_ACCESS_ROLES.has(item.role) && item.congregation_id)?.congregation_id ??
    null;
  const effectiveCongregation =
    (hasGlobalDiscipuladoAdmin || hasGlobalAdmin ? requestedCongregation : null) ?? ownCongregation;
  const cacheKey = effectiveCongregation ?? "__all__";

  if (hasCongregationId && !effectiveCongregation && !hasGlobalDiscipuladoAdmin && !hasGlobalAdmin) {
    return NextResponse.json({ error: "congregation not found" }, { status: 400 });
  }

  const now = Date.now();
  const cachedAssignees = assigneeCache.get(cacheKey);
  if (cachedAssignees && cachedAssignees.expiresAt > now) {
    return NextResponse.json({ assignees: cachedAssignees.value });
  }

  let assigneeRolesQuery = (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select(hasCongregationId ? "user_id, role, congregation_id" : "user_id, role")
    .eq("active", true)
    .in("role", ASSIGNEE_ROLES);
  if (hasCongregationId && effectiveCongregation) {
    assigneeRolesQuery = assigneeRolesQuery.eq("congregation_id", effectiveCongregation);
  }

  const { data: assigneeRoles, error: assigneeRolesError } = await assigneeRolesQuery;
  if (assigneeRolesError) {
    return NextResponse.json({ error: assigneeRolesError.message }, { status: 500 });
  }

  const userIds = Array.from(
    new Set(
      ((assigneeRoles ?? []) as Array<{ user_id: string | null }>)
        .map((item) => item.user_id)
        .filter((item): item is string => Boolean(item))
    )
  );
  if (!userIds.length) {
    assigneeCache.set(cacheKey, { value: [], expiresAt: now + ASSIGNEE_CACHE_TTL_MS });
    return NextResponse.json({ assignees: [] });
  }

  const usersResult = await Promise.all(userIds.map(async (userId) => {
    const cachedUserEmail = userEmailCache.get(userId);
    if (cachedUserEmail && cachedUserEmail.expiresAt > now) {
      return {
        id: userId,
        label: cachedUserEmail.value ?? `ID ${userId.slice(0, 8)}`
      };
    }

    const result = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = result.data.user?.email ?? null;
    userEmailCache.set(userId, {
      value: email,
      expiresAt: now + USER_EMAIL_CACHE_TTL_MS
    });

    return {
      id: userId,
      label: email ?? `ID ${userId.slice(0, 8)}`
    };
  }));

  const assignees = usersResult.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  assigneeCache.set(cacheKey, { value: assignees, expiresAt: now + ASSIGNEE_CACHE_TTL_MS });
  return NextResponse.json({ assignees });
}
