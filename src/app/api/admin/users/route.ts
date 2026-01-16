import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200, page: 1 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = data.users.map((user) => user.id);
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("usuarios_perfis")
    .select("user_id, role, active")
    .in("user_id", ids);

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  const rolesByUser = ((roles ?? []) as { user_id: string; role: string; active: boolean }[]).reduce<
    Record<string, { role: string; active: boolean }[]>
  >(
    (acc, item) => {
      acc[item.user_id] = acc[item.user_id] ?? [];
      acc[item.user_id].push({ role: item.role, active: item.active });
      return acc;
    },
    {}
  );

  const users = data.users.map((user) => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    roles: rolesByUser[user.id] ?? []
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

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
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
    const payload = { user_id: data.user.id, role, active: true };
    const { error: roleError } = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .upsert(payload);
    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: data.user.id });
}
