import { supabaseClient } from "@/lib/supabaseClient";

export type AuthScope = {
  roles: string[];
  congregationId: string | null;
  isAdminMaster: boolean;
};

export const DISCIPULADO_ACCOUNT_ROLES = [
  "ADMIN_DISCIPULADO",
  "DISCIPULADOR",
  "SM_DISCIPULADO",
  "SECRETARIA_DISCIPULADO"
] as const;
export const DISCIPULADO_ADMIN_ROLES = ["ADMIN_DISCIPULADO"] as const;

export function hasDiscipuladoAccessRole(roles: string[]) {
  return roles.some((role) => DISCIPULADO_ACCOUNT_ROLES.includes(role as (typeof DISCIPULADO_ACCOUNT_ROLES)[number]));
}

export function hasDiscipuladoAdminRole(roles: string[]) {
  return roles.some((role) => DISCIPULADO_ADMIN_ROLES.includes(role as (typeof DISCIPULADO_ADMIN_ROLES)[number]));
}

export function isDiscipuladoScopedAccount(roles: string[], isGlobalAdmin: boolean) {
  if (isGlobalAdmin) return false;
  return roles.some((role) => DISCIPULADO_ACCOUNT_ROLES.includes(role as (typeof DISCIPULADO_ACCOUNT_ROLES)[number]));
}

export function getDiscipuladoHomePath(roles: string[]) {
  const hasCadastroOnlyRole =
    !roles.includes("DISCIPULADOR") &&
    (roles.includes("SM_DISCIPULADO") || roles.includes("SECRETARIA_DISCIPULADO"));
  return hasCadastroOnlyRole ? "/discipulado/convertidos/novo" : "/discipulado";
}

export async function getAuthScope(): Promise<AuthScope> {
  if (!supabaseClient) {
    return { roles: [], congregationId: null, isAdminMaster: false };
  }

  const { data, error } = await supabaseClient.rpc("get_my_context");
  if (!error && data) {
    const payload = data as {
      roles?: string[];
      congregation_id?: string | null;
      is_admin_master?: boolean;
    };

    const roles = payload.roles ?? [];
    return {
      roles,
      congregationId: payload.congregation_id ?? null,
      isAdminMaster:
        Boolean(payload.is_admin_master) ||
        roles.includes("ADMIN_MASTER") ||
        roles.includes("SUPER_ADMIN")
    };
  }

  const { data: legacyRoles } = await supabaseClient.rpc("get_my_roles");
  const roles = (legacyRoles ?? []) as string[];

  return {
    roles,
    congregationId: null,
    isAdminMaster: roles.includes("ADMIN_MASTER") || roles.includes("SUPER_ADMIN")
  };
}
