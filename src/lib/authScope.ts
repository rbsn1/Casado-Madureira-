import { supabaseClient } from "@/lib/supabaseClient";

export type AuthScope = {
  roles: string[];
  congregationId: string | null;
  isAdminMaster: boolean;
};

export async function getAuthScope(): Promise<AuthScope> {
  if (!supabaseClient) {
    return { roles: [], congregationId: null, isAdminMaster: false };
  }

  const { data, error } = await supabaseClient.rpc("get_my_context");
  if (error || !data) {
    return { roles: [], congregationId: null, isAdminMaster: false };
  }

  const payload = data as {
    roles?: string[];
    congregation_id?: string | null;
    is_admin_master?: boolean;
  };

  return {
    roles: payload.roles ?? [],
    congregationId: payload.congregation_id ?? null,
    isAdminMaster: Boolean(payload.is_admin_master)
  };
}
