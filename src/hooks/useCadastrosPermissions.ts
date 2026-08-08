"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type CadastrosPermissions = {
  isCadastradorOnly: boolean;
  canManageCadastrosDirectly: boolean;
  canGenerateCompletionLink: boolean;
};

export function useCadastrosPermissions(): CadastrosPermissions {
  const [isCadastradorOnly, setIsCadastradorOnly] = useState(false);
  const [canManageCadastrosDirectly, setCanManageCadastrosDirectly] = useState(false);
  const [canGenerateCompletionLink, setCanGenerateCompletionLink] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.rpc("get_my_roles");
      if (!active) return;
      const roles = (data ?? []) as string[];
      setIsCadastradorOnly(roles.length === 1 && roles.includes("CADASTRADOR"));
      setCanManageCadastrosDirectly(
        roles.some((role) => ["ADMIN_MASTER", "PASTOR", "SECRETARIA"].includes(role))
      );
      setCanGenerateCompletionLink(
        roles.some((role) =>
          ["ADMIN_MASTER", "PASTOR", "SECRETARIA", "NOVOS_CONVERTIDOS", "CADASTRADOR"].includes(role)
        )
      );
    }

    loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  return { isCadastradorOnly, canManageCadastrosDirectly, canGenerateCompletionLink };
}
