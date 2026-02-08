import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200, page: 1 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = data.users.map((user) => user.id);
  if (!ids.length) {
    return NextResponse.json({ users: [] });
  }

  const hasCongregationId = await hasColumn("usuarios_perfis", "congregation_id");
  const rolesSelect = hasCongregationId ? "user_id, role, active, congregation_id" : "user_id, role, active";
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("usuarios_perfis")
    .select(rolesSelect)
    .in("user_id", ids);

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

  const users = data.users.map((user) => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    roles: rolesByUser[user.id] ?? [],
    whatsapp: contactByUser[user.id]?.whatsapp ?? null
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const role = body.role ? String(body.role) : null;
  const congregationId = body.congregationId ? String(body.congregationId) : null;
  const whatsapp = body.whatsapp ? String(body.whatsapp) : null;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (role === "DISCIPULADOR" && !congregationId) {
    return NextResponse.json(
      { error: "congregationId is required for DISCIPULADOR users" },
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

  if (role) {
    const hasCongregationId = await hasColumn("usuarios_perfis", "congregation_id");
    if (congregationId && !hasCongregationId) {
      return NextResponse.json(
        { error: "A coluna congregation_id não existe em usuarios_perfis. Aplique a migração multi-congregação." },
        { status: 400 }
      );
    }

    const payload = hasCongregationId
      ? { user_id: data.user.id, role, active: true, congregation_id: congregationId }
      : { user_id: data.user.id, role, active: true };
    const { error: roleError } = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .upsert(payload);
    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }
  }

  if (whatsapp) {
    const { error: contactError } = await (supabaseAdmin as any)
      .from("user_contacts")
      .upsert({ user_id: data.user.id, whatsapp });
    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: data.user.id });
}
