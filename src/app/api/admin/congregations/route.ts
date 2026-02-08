import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDiscipuladoAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  let query = (supabaseAdmin as any)
    .from("congregations")
    .select("id, name, slug, is_active, created_at")
    .order("name");
  if (!auth.isGlobalAdmin && auth.congregationId) {
    query = query.eq("id", auth.congregationId);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ congregations: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;
  if (!auth.isGlobalAdmin) {
    return NextResponse.json(
      { error: "Somente administradores globais podem criar congregações." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const slugInput = String(body.slug ?? "").trim();
  const isActive = body.isActive !== false;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await (supabaseAdmin as any)
    .from("congregations")
    .insert({
      name,
      slug,
      is_active: isActive
    })
    .select("id, name, slug, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma congregação com este slug." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ congregation: data });
}
