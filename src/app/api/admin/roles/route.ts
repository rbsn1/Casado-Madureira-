import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.json();
  const userId = String(body.userId ?? "");
  const role = String(body.role ?? "");
  const active = body.active !== false;
  const congregationId = body.congregationId ? String(body.congregationId) : null;

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }
  if (role === "DISCIPULADOR" && !congregationId) {
    return NextResponse.json(
      { error: "congregationId is required for DISCIPULADOR roles" },
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

  const payload = hasCongregationId
    ? { user_id: userId, role, active, congregation_id: congregationId }
    : { user_id: userId, role, active };
  const { error } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .upsert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
