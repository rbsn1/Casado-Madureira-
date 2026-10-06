"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type CadastrosPermissions = {
  canManageCadastrosDirectly: boolean;
};

export function useCadastrosPermissions(): CadastrosPermissions {
  const [canManageCadastrosDirectly, setCanManageCadastrosDirectly] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.rpc("get_my_roles");
      if (!active) return;
      const roles = (data ?? []) as string[];
      setCanManageCadastrosDirectly(
        roles.some((role) => ["ADMIN_MASTER", "PASTOR", "SECRETARIA"].includes(role))
      );
    }

    loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  return { canManageCadastrosDirectly };
}
