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

async function hasColumn(table: string, column: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (table !== "usuarios_perfis" || column !== "congregation_id") return false;
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

export async function GET(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const pageParam = Number(searchParams.get("page") ?? "1");
  const perPageParam = Number(searchParams.get("perPage") ?? "200");
  const roleFilter = searchParams.get("role")?.trim() || null;
  const requestedCongregationFilter = searchParams.get("congregationId")?.trim() || null;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const perPage = Number.isFinite(perPageParam)
    ? Math.max(1, Math.min(200, Math.floor(perPageParam)))
    : 200;
  const congregationFilter = auth.isGlobalAdmin
    ? requestedCongregationFilter
    : auth.congregationId;

  if (!auth.isGlobalAdmin && roleFilter && !DISCIPULADO_ONLY_ROLES.has(roleFilter)) {
    return NextResponse.json(
      { error: "Administradores de discipulado só podem consultar papéis do discipulado." },
      { status: 403 }
    );
  }
  if (
    !auth.isGlobalAdmin &&
    requestedCongregationFilter &&
    requestedCongregationFilter !== auth.congregationId
  ) {
    return NextResponse.json(
      { error: "Você só pode consultar usuários da sua congregação." },
      { status: 403 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage, page });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = data.users.map((user) => user.id);
  if (!ids.length) {
    return NextResponse.json({ users: [] });
  }

  const hasCongregationId = await hasColumn("usuarios_perfis", "congregation_id");
  if (congregationFilter && !hasCongregationId) {
    return NextResponse.json(
      { error: "A coluna congregation_id não existe em usuarios_perfis. Aplique a migração multi-congregação." },
      { status: 400 }
    );
  }
  const rolesSelect = hasCongregationId ? "user_id, role, active, congregation_id" : "user_id, role, active";
  let rolesQuery = supabaseAdmin
    .from("usuarios_perfis")
    .select(rolesSelect)
    .in("user_id", ids);
  if (!auth.isGlobalAdmin) {
    rolesQuery = rolesQuery.in("role", Array.from(DISCIPULADO_ONLY_ROLES));
  }
  if (roleFilter) {
    rolesQuery = rolesQuery.eq("role", roleFilter);
  }
  if (congregationFilter && hasCongregationId) {
    rolesQuery = rolesQuery.eq("congregation_id", congregationFilter);
  }
  const { data: roles, error: roleError } = await rolesQuery;

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  const { data: contacts, error: contactError } = await supabaseAdmin
    .from("user_contacts")
    .select("user_id, whatsapp")
    .in("user_id", ids);

  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }

  const contactByUser = ((contacts ?? []) as { user_id: string; whatsapp: string | null }[]).reduce<
    Record<string, { whatsapp: string | null }>
  >((acc, item) => {
    acc[item.user_id] = { whatsapp: item.whatsapp };
    return acc;
  }, {});

  const rolesByUser = (
    (roles ?? []) as { user_id: string; role: string; active: boolean; congregation_id?: string | null }[]
  ).reduce<
    Record<string, { role: string; active: boolean; congregation_id: string | null }[]>
  >(
    (acc, item) => {
      acc[item.user_id] = acc[item.user_id] ?? [];
      acc[item.user_id].push({
        role: item.role,
        active: item.active,
        congregation_id: item.congregation_id ?? null
      });
      return acc;
    },
    {}
  );

  let users = data.users.map((user) => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    roles: rolesByUser[user.id] ?? [],
    whatsapp: contactByUser[user.id]?.whatsapp ?? null
  }));

  if (roleFilter || congregationFilter) {
    users = users.filter((user) => user.roles.length > 0);
  }

  const responseData = data as { nextPage?: number | null; lastPage?: number | null };
  return NextResponse.json({
    users,
    page,
    perPage,
    nextPage: responseData.nextPage ?? null,
    lastPage: responseData.lastPage ?? null
  });
}

export async function POST(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const role = body.role ? String(body.role) : null;
  const requestedCongregationId = body.congregationId ? String(body.congregationId) : null;
  const whatsapp = body.whatsapp ? String(body.whatsapp) : null;

  if (!auth.isGlobalAdmin && role && !DISCIPULADO_ONLY_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Administradores de discipulado só podem criar usuários com papéis do discipulado." },
      { status: 403 }
    );
  }
  if (
    !auth.isGlobalAdmin &&
    requestedCongregationId &&
    requestedCongregationId !== auth.congregationId
  ) {
    return NextResponse.json(
      { error: "Você só pode criar usuários vinculados à sua congregação." },
      { status: 403 }
    );
  }

  const congregationId = auth.isGlobalAdmin ? requestedCongregationId : auth.congregationId;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (role && DISCIPULADO_ONLY_ROLES.has(role) && !congregationId) {
    return NextResponse.json(
      {
        error:
          "congregationId is required for ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO and SECRETARIA_DISCIPULADO users"
      },
      { status: 400 }
    );
  }

  const hasCongregationId = await hasColumn("usuarios_perfis", "congregation_id");
  if (congregationId && !hasCongregationId) {
    return NextResponse.json(
      { error: "A coluna congregation_id não existe em usuarios_perfis. Aplique a migração multi-congregação." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "failed to create user" }, { status: 500 });
  }
  const createdUserId = data.user.id;

  async function rollbackUserCreation(message: string) {
    await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (role) {
    const targetCongregationId = hasCongregationId
      ? congregationId ?? (await resolveDefaultCongregationId())
      : null;

    if (hasCongregationId && !targetCongregationId) {
      return rollbackUserCreation("Nenhuma congregação disponível para vincular o usuário.");
    }

    const payload = hasCongregationId
      ? { user_id: createdUserId, role, active: true, congregation_id: targetCongregationId }
      : { user_id: createdUserId, role, active: true };
    const { error: roleError } = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .upsert(payload);
    if (roleError) {
      return rollbackUserCreation(roleError.message);
    }
  }

  if (whatsapp) {
    const { error: contactError } = await (supabaseAdmin as any)
      .from("user_contacts")
      .upsert({ user_id: createdUserId, whatsapp });
    if (contactError) {
      return rollbackUserCreation(contactError.message);
    }
  }

  await syncLegacyProfileRoleForUser(createdUserId);

  return NextResponse.json({ id: createdUserId });
}
