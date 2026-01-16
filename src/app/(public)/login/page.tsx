"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadBackground() {
      try {
        const response = await fetch("/api/settings?key=login_background_url");
        const data = await response.json();
        if (response.ok && data.value) setBgUrl(data.value);
      } catch {
        // ignore
      }
    }

    loadBackground();
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf3_0%,_#f7faf9_45%,_#ffffff_100%)]">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <span className="pill bg-emerald-100 text-emerald-900">Acesso interno</span>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold text-emerald-900">Entre no painel</h1>
            <p className="text-base text-slate-600">
              Centralize o acompanhamento de integrações, batismos e voluntariado. Use seu e-mail
              institucional para entrar.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-900">Cadastro público</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/cadastro"
                className="group rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase text-emerald-600">Casados com a Madureira</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Cadastro rápido do casal
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Envio em até 1 minuto.
                </p>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-800 group-hover:text-emerald-900">
                  Cadastrar agora →
                </span>
              </Link>
              <Link
                href="/novos-convertidos/cadastro"
                className="group rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase text-emerald-600">Novos Convertidos</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Inicie o acompanhamento
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Equipe entra em contato.
                </p>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-800 group-hover:text-emerald-900">
                  Cadastrar agora →
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="card p-6 shadow-lg">
          {bgUrl ? (
            <div className="mb-6 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgUrl}
                alt="Logo Casados com a Madureira"
                className="h-40 w-auto max-w-[540px] object-contain"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Bem-vindo(a) de volta</p>
            <h2 className="text-2xl font-semibold text-emerald-900">Acesso ao painel interno</h2>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="voce@casados.com"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Manter conectado
              </label>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="font-semibold text-emerald-800 hover:text-emerald-900"
              >
                Esqueci minha senha
              </button>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Entrando..." : "Entrar"}
            </button>
            {status === "error" ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {message || "Não foi possível entrar. Verifique suas credenciais."}
              </p>
            ) : null}
            {status === "idle" && message ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
