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

      const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setRole("user");
        setLoading(false);
        return;
      }

      setRole(profile?.role === "admin" ? "admin" : "user");
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
