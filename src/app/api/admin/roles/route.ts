import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDiscipuladoAdmin } from "@/lib/serverAuth";
import { syncLegacyProfileRoleForUser } from "@/lib/userProfileSync";

export const runtime = "nodejs";

const DISCIPULADO_ONLY_ROLES = new Set([
  "ADMIN_DISCIPULADO",
  "DISCIPULADOR",
  "SM_DISCIPULADO",
  "SECRETARIA_DISCIPULADO"
]);

async function hasCongregationColumn() {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("congregation_id")
    .limit(1);

  if (!error) return true;
  if (error.message?.toLowerCase().includes("congregation_id")) return false;
  return false;
}

async function resolveDefaultCongregationId() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: sedeData } = await (supabaseAdmin as any)
    .from("congregations")
    .select("id")
    .eq("slug", "sede")
    .limit(1)
    .maybeSingle();

  if (sedeData?.id) return String(sedeData.id);

  const { data: firstActive } = await (supabaseAdmin as any)
    .from("congregations")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstActive?.id ? String(firstActive.id) : null;
}

async function resolveUserCongregationId(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("congregation_id")
    .eq("user_id", userId)
    .not("congregation_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.congregation_id ? String(data.congregation_id) : null;
}

export async function POST(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.json();
  const userId = String(body.userId ?? "");
  const role = String(body.role ?? "");
  const active = body.active !== false;
  const incomingIsDiscipuladoOnly = DISCIPULADO_ONLY_ROLES.has(role);
  const requestedCongregationId = body.congregationId ? String(body.congregationId) : null;
  const allowGlobalDiscipuladoAdmin =
    auth.isGlobalAdmin && role === "ADMIN_DISCIPULADO" && !requestedCongregationId;

  if (!auth.isGlobalAdmin && !DISCIPULADO_ONLY_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Administradores de discipulado só podem gerenciar papéis do discipulado." },
      { status: 403 }
    );
  }
  if (
    !auth.isGlobalAdmin &&
    requestedCongregationId &&
    requestedCongregationId !== auth.congregationId
  ) {
    return NextResponse.json(
      { error: "Você só pode gerenciar papéis da sua congregação." },
      { status: 403 }
    );
  }

  const congregationId = auth.isGlobalAdmin ? requestedCongregationId : auth.congregationId;

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }
  if (incomingIsDiscipuladoOnly && active && !congregationId && !allowGlobalDiscipuladoAdmin) {
    return NextResponse.json(
      {
        error:
          "congregationId is required for ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO and SECRETARIA_DISCIPULADO roles"
      },
      { status: 400 }
    );
  }

  const hasCongregationId = await hasCongregationColumn();
  if (congregationId && !hasCongregationId) {
    return NextResponse.json(
      { error: "A coluna congregation_id não existe em usuarios_perfis. Aplique a migração multi-congregação." },
      { status: 400 }
    );
  }

  if (active) {
    const { data: activeRoles, error: activeRolesError } = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .select("role")
      .eq("user_id", userId)
      .eq("active", true);

    if (activeRolesError) {
      return NextResponse.json({ error: activeRolesError.message }, { status: 500 });
    }

    const currentRoles = ((activeRoles ?? []) as { role: string }[]).map((item) => item.role);
    const hasActiveDiscipuladoOnlyRole = currentRoles.some((existingRole) =>
      DISCIPULADO_ONLY_ROLES.has(existingRole)
    );

    if (!incomingIsDiscipuladoOnly && hasActiveDiscipuladoOnlyRole) {
      return NextResponse.json(
        { error: "Usuário com perfil de discipulado ativo não pode receber papéis do CCM/admin." },
        { status: 409 }
      );
    }
  }

  const targetCongregationId = hasCongregationId
    ? allowGlobalDiscipuladoAdmin
      ? null
      : congregationId ?? (await resolveUserCongregationId(userId)) ?? (await resolveDefaultCongregationId())
    : null;

  if (!auth.isGlobalAdmin && targetCongregationId !== auth.congregationId) {
    return NextResponse.json(
      { error: "Você só pode gerenciar usuários vinculados à sua congregação." },
      { status: 403 }
    );
  }

  if (hasCongregationId && !targetCongregationId && !allowGlobalDiscipuladoAdmin) {
    return NextResponse.json({ error: "Nenhuma congregação disponível para vincular o papel." }, { status: 400 });
  }

  if (active && incomingIsDiscipuladoOnly) {
    const { error: deactivateRolesError } = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .update({ active: false })
      .eq("user_id", userId)
      .neq("role", role)
      .eq("active", true);

    if (deactivateRolesError) {
      return NextResponse.json({ error: deactivateRolesError.message }, { status: 500 });
    }
  }

  const payload = hasCongregationId
    ? { user_id: userId, role, active, congregation_id: targetCongregationId }
    : { user_id: userId, role, active };
  const { error } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .upsert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await syncLegacyProfileRoleForUser(userId);

  return NextResponse.json({ ok: true });
}
