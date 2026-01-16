import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin.from("app_settings").select("key, value");
  if (key) query = query.eq("key", key);

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes("app_settings")) {
      return NextResponse.json(key ? { value: null } : { settings: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (key) {
    return NextResponse.json({ value: data?.[0]?.value ?? null });
  }

  return NextResponse.json({ settings: data ?? [] });
}
