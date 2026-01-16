import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const supabaseAdmin = getSupabaseAdmin();
  const formData = await request.formData();
  const file = formData.get("file") ?? formData.get("background");
  const isFileLike =
    file &&
    typeof file === "object" &&
    "arrayBuffer" in file &&
    "type" in file &&
    "name" in file;
  if (!isFileLike) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const uploadFile = file as File;
  const ext = uploadFile.name.split(".").pop() ?? "jpg";
  const path = `login-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await uploadFile.arrayBuffer());

  const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
  if (bucketError) {
    return NextResponse.json({ error: bucketError.message }, { status: 500 });
  }
  const exists = (buckets ?? []).some((bucket) => bucket.id === "login-backgrounds");
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket("login-backgrounds", {
      public: true
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from("login-backgrounds")
    .upload(path, buffer, { contentType: uploadFile.type || "image/jpeg", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabaseAdmin.storage
    .from("login-backgrounds")
    .getPublicUrl(path);

  const settingsPayload = {
    key: "login_background_url",
    value: publicUrl.publicUrl
  };
  const { error: settingsError } = await (supabaseAdmin as any)
    .from("app_settings")
    .upsert(settingsPayload);

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl.publicUrl });
}
