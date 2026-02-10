import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ActiveRoleRow = {
  role: string;
};

function isProfilesUnavailableError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("relation") && msg.includes("profiles") && msg.includes("does not exist")
  ) || msg.includes("column") && msg.includes("profiles");
}

export async function syncLegacyProfileRoleForUser(userId: string) {
  if (!userId) return;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: activeRoles, error: activeRolesError } = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("role")
    .eq("user_id", userId)
    .eq("active", true);

  if (activeRolesError) return;

  const roles = ((activeRoles ?? []) as ActiveRoleRow[]).map((item) => item.role);
  const profileRole = roles.some((role) => role === "ADMIN_MASTER" || role === "SUPER_ADMIN")
    ? "admin"
    : "user";

  const { data: existingProfile, error: existingProfileError } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (isProfilesUnavailableError(existingProfileError)) return;
  if (existingProfileError) return;

  if (existingProfile?.id) {
    await (supabaseAdmin as any)
      .from("profiles")
      .update({ role: profileRole })
      .eq("id", userId);
    return;
  }

  await (supabaseAdmin as any).from("profiles").insert({ id: userId, role: profileRole });
}

