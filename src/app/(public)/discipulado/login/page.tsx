"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";

type LoginStatus = "idle" | "loading" | "error";

const cardClass =
  "rounded-2xl border border-sky-100/80 bg-white/92 p-6 shadow-xl shadow-sky-200/35 backdrop-blur";

export default function DiscipuladoLoginPage() {
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

    const [{ data: rolesData }, { data: contextData }] = await Promise.all([
      supabaseClient.rpc("get_my_roles"),
      supabaseClient.rpc("get_my_context")
    ]);
    const roles = (rolesData ?? []) as string[];
    const context = (contextData ?? {}) as { is_admin_master?: boolean };
    const isGlobalAdmin =
      Boolean(context.is_admin_master) || roles.includes("ADMIN_MASTER") || roles.includes("SUPER_ADMIN");
    if (!isGlobalAdmin && roles.includes("SM_DISCIPULADO")) {
      router.push("/discipulado/convertidos/novo");
      return;
    }
    if (isGlobalAdmin || roles.includes("DISCIPULADOR")) {
      router.push("/discipulado");
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
    <PortalBackground heroImageSrc="/taladelogindis.png" heroHeight="460px" theme="discipulado">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div
            className="absolute -left-16 top-24 hidden h-[360px] w-[260px] rounded-[30px] border border-white/35 bg-cover bg-center opacity-80 shadow-2xl shadow-sky-900/20 ring-1 ring-sky-200/30 lg:block"
            style={{
              backgroundImage:
                "linear-gradient(160deg, rgba(10,37,64,0.58), rgba(12,74,110,0.12)), url('/taladelogindis.png')"
            }}
          />
          <div
            className="absolute -right-10 bottom-16 hidden h-[320px] w-[280px] rounded-[34px] border border-white/30 bg-cover bg-center opacity-80 shadow-2xl shadow-indigo-900/20 ring-1 ring-indigo-200/40 md:block"
            style={{
              backgroundImage:
                "linear-gradient(150deg, rgba(15,23,42,0.52), rgba(56,189,248,0.16)), url('/taladelogindis.png')"
            }}
          />
          <div className="absolute left-10 top-40 hidden h-40 w-40 rounded-full bg-sky-300/30 blur-3xl lg:block" />
          <div className="absolute right-20 top-28 hidden h-44 w-44 rounded-full bg-indigo-300/25 blur-3xl lg:block" />
        </div>
        <header className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-700 text-xs font-semibold text-white">
              DC
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Portal Discipulado
              </p>
              <p className="text-sm font-semibold text-sky-900">Acesso do módulo</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-sky-800 transition hover:text-sky-900"
          >
            Voltar ao portal →
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center pt-10">
          <div className={`${cardClass} w-full max-w-md`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Discipulado</p>
            <h1 className="mt-2 text-2xl font-semibold text-sky-950">Entrar no módulo</h1>
            <p className="mt-2 text-sm text-slate-600">
              Use seu e-mail institucional para acessar o acompanhamento de discipulado.
            </p>
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  Manter conectado
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="font-semibold text-sky-800 hover:text-sky-900"
                >
                  Esqueci minha senha
                </button>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Entrando..." : "Entrar no discipulado"}
              </button>
              {status === "error" ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {message || "Não foi possível entrar. Verifique suas credenciais."}
                </p>
              ) : null}
              {status === "idle" && message ? (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  {message}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </div>
    </PortalBackground>
  );
}
