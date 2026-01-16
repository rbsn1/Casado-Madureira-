"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "idle" | "error" | "success">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      if (!supabaseClient) {
        setStatus("error");
        setMessage("Supabase não configurado.");
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) {
        setStatus("error");
        setMessage("Link de recuperação inválido ou expirado.");
        return;
      }
      setStatus("idle");
    }

    checkSession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;
    setStatus("loading");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (!password || password.length < 6) {
      setStatus("error");
      setMessage("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("As senhas não conferem.");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("success");
    setMessage("Senha atualizada. Faça login novamente.");
    setTimeout(() => router.push("/login"), 1000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-700">Casados com a Madureira</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-900">Redefinir senha</h1>
        </div>

        <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nova senha</span>
            <input
              name="password"
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Confirmar senha</span>
            <input
              name="confirm"
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Salvando..." : "Atualizar senha"}
          </button>
          {status === "error" ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {message}
            </p>
          ) : null}
          {status === "success" ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
