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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;
  if (!auth.isGlobalAdmin) {
    return NextResponse.json(
      { error: "Somente administradores globais podem editar congregações." },
      { status: 403 }
    );
  }

  const id = String(params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = await request.json();
  const name = body.name !== undefined ? String(body.name ?? "").trim() : undefined;
  const slugInput = body.slug !== undefined ? String(body.slug ?? "").trim() : undefined;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : undefined;

  const payload: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    payload.name = name;
  }
  if (slugInput !== undefined) {
    const slug = slugify(slugInput);
    if (!slug) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    payload.slug = slug;
  }
  if (isActive !== undefined) {
    payload.is_active = isActive;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await (supabaseAdmin as any)
    .from("congregations")
    .update(payload)
    .eq("id", id)
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
