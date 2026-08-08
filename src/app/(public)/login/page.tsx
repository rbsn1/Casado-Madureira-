"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";

type LoginStatus = "idle" | "loading" | "error";

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-6 shadow-lg shadow-black/5 backdrop-blur";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");
  const [emailValue, setEmailValue] = useState("");

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
    const { data } = await supabaseClient.rpc("get_my_roles");
    const roles = (data ?? []) as string[];

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
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="420px">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/90 text-sm font-semibold text-white">
            CCM
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              Portal CCM
            </p>
            <p className="text-sm font-semibold text-brand-900">Casados com a Madureira</p>
          </div>
        </div>

        <div className={cardClass}>
          <h1 className="text-2xl font-semibold text-brand-900">Entrar</h1>
          <p className="mt-2 text-sm text-text-muted">
            Utilize seu e-mail institucional para acessar o painel.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="voce@casados.com"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm text-text shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm text-text shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="flex items-center justify-end text-sm text-text-muted">
              <button
                type="button"
                onClick={handlePasswordReset}
                className="font-semibold text-brand-800 hover:text-brand-900"
              >
                Esqueci minha senha
              </button>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Entrando..." : "Entrar"}
            </button>
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
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          <Link href="/agenda" className="font-semibold text-brand-800 hover:text-brand-900">
            Ver agenda
          </Link>
          {" · "}
          <Link href="/cadastro" className="font-semibold text-brand-800 hover:text-brand-900">
            Cadastro
          </Link>
        </p>
      </div>
    </PortalBackground>
  );
}
