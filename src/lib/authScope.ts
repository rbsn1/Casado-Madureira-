import { supabaseClient } from "@/lib/supabaseClient";

export type AuthScope = {
  roles: string[];
  congregationId: string | null;
  isAdminMaster: boolean;
};

const AUTH_SCOPE_TTL_MS = 15000;
let cachedScope: AuthScope | null = null;
let cachedAt = 0;
let inflightScopePromise: Promise<AuthScope> | null = null;

export async function getAuthScope(): Promise<AuthScope> {
  if (!supabaseClient) {
    return { roles: [], congregationId: null, isAdminMaster: false };
  }

  const now = Date.now();
  if (cachedScope && now - cachedAt < AUTH_SCOPE_TTL_MS) {
    return cachedScope;
  }

  if (inflightScopePromise) {
    return inflightScopePromise;
  }

  inflightScopePromise = (async () => {
    const { data, error } = await supabaseClient.rpc("get_my_context");
    if (!error && data) {
      const payload = data as {
        roles?: string[];
        congregation_id?: string | null;
        is_admin_master?: boolean;
      };

      const roles = payload.roles ?? [];
      const resolved: AuthScope = {
        roles,
        congregationId: payload.congregation_id ?? null,
        isAdminMaster:
          Boolean(payload.is_admin_master) ||
          roles.includes("ADMIN_MASTER") ||
          roles.includes("SUPER_ADMIN")
      };
      cachedScope = resolved;
      cachedAt = Date.now();
      return resolved;
    }

    const { data: legacyRoles } = await supabaseClient.rpc("get_my_roles");
    const roles = (legacyRoles ?? []) as string[];
    const resolved: AuthScope = {
      roles,
      congregationId: null,
      isAdminMaster: roles.includes("ADMIN_MASTER") || roles.includes("SUPER_ADMIN")
    };
    cachedScope = resolved;
    cachedAt = Date.now();
    return resolved;
  })();

  try {
    return await inflightScopePromise;
  } finally {
    inflightScopePromise = null;
  }
}
