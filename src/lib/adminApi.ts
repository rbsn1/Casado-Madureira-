import { supabaseClient } from "@/lib/supabaseClient";

export async function apiFetch(path: string, options: RequestInit = {}) {
  if (!supabaseClient) throw new Error("Supabase não configurado.");
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa.");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro na requisição.");
  return payload;
}
