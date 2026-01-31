import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type AuthState = {
  user: { id: string; email: string | null } | null;
  role: "admin" | "user" | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [role, setRole] = useState<AuthState["role"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabaseClient) {
        if (active) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabaseClient.auth.getUser();
      if (!active) return;
      const currentUser = data.user
        ? { id: data.user.id, email: data.user.email ?? null }
        : null;
      setUser(currentUser);

      if (!currentUser) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data: roles, error } = await supabaseClient
        .from("usuarios_perfis")
        .select("role, active")
        .eq("user_id", currentUser.id)
        .eq("active", true);

      if (!active) return;
      if (error) {
        setRole("user");
        setLoading(false);
        return;
      }

      const hasAdmin = (roles ?? []).some((item: { role: string }) => item.role === "ADMIN_MASTER");
      setRole(hasAdmin ? "admin" : "user");
      setLoading(false);
    }

    load();

    if (!supabaseClient) return () => {};

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? null }
        : null;
      setUser(sessionUser);
      setRole(sessionUser ? "user" : null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading };
}
