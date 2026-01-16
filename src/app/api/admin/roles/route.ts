import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.json();
  const userId = String(body.userId ?? "");
  const role = String(body.role ?? "");
  const active = body.active !== false;

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  const payload = { user_id: userId, role, active };
  const { error } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .upsert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
