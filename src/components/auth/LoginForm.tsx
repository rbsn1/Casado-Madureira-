"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type LoginStatus = "idle" | "loading" | "error";

export function LoginForm({ showRememberMe = false }: { showRememberMe?: boolean }) {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");
  const [emailValue, setEmailValue] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next") ?? "";
    if (!requested.startsWith("/") || requested.startsWith("//")) {
      setNextPath(null);
      return;
    }
    setNextPath(requested);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = emailValue || String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("idle");
    const scope = await getAuthScope();
    const roles = scope.roles;

    if (nextPath) {
      router.push(nextPath);
      return;
    }

    if (roles.length === 1 && roles.includes("CADASTRADOR")) {
      router.push("/cadastro");
      return;
    }
    router.push("/");
  }

  async function handlePasswordReset() {
    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }
    if (!emailValue) {
      setStatus("error");
      setMessage("Digite seu e-mail para receber o link de recuperação.");
      return;
    }
    setStatus("loading");
    setMessage("");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(emailValue, {
      redirectTo: `${window.location.origin}/reset`
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("idle");
    setMessage("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-text" htmlFor="email">
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="voce@casados.com"
          value={emailValue}
          onChange={(event) => setEmailValue(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-text" htmlFor="password">
          Senha
        </label>
        <Input id="password" name="password" type="password" required placeholder="••••••••" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
        {showRememberMe ? (
          <label className="flex items-center gap-2">
            <Checkbox />
            Manter conectado
          </label>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handlePasswordReset}
          className="font-semibold text-brand-700 hover:text-brand-900"
        >
          Esqueci minha senha
        </button>
      </div>
      <Button type="submit" className="w-full h-12 shadow-lg shadow-brand-900/10" disabled={status === "loading"}>
        {status === "loading" ? "Entrando..." : "Entrar"}
      </Button>
      {status === "error" ? (
        <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
          {message || "Não foi possível entrar. Verifique suas credenciais."}
        </p>
      ) : null}
      {status === "idle" && message ? (
        <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}
