"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "./loginBackground.module.css";

type LoginStatus = "idle" | "loading" | "error";

const cardClass =
  "w-full max-w-md rounded-[1.35rem] border border-amber-50/80 bg-white/82 p-6 shadow-[0_32px_86px_-38px_rgba(53,41,20,0.42)] backdrop-blur-xl";
const inputClass =
  "w-full rounded-xl border border-slate-200/90 bg-white/92 px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100";

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
    const isDiscipuladoAccount =
      !isGlobalAdmin && (roles.includes("DISCIPULADOR") || roles.includes("SM_DISCIPULADO"));
    const isSmDiscipuladoOnly = !isGlobalAdmin && roles.length === 1 && roles.includes("SM_DISCIPULADO");
    if (!isGlobalAdmin && roles.includes("CADASTRADOR")) {
      router.push("/discipulado/convertidos/novo");
      return;
    }
    if (isDiscipuladoAccount) {
      router.push(isSmDiscipuladoOnly ? "/discipulado/convertidos/novo" : "/discipulado");
      return;
    }
    if (isGlobalAdmin) {
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
    <div className={styles.page}>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16">
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
          <div className={cardClass}>
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
                  className={inputClass}
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
                  className={inputClass}
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
                className="w-full rounded-xl bg-gradient-to-r from-sky-700 via-teal-700 to-amber-700 px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
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
    </div>
  );
}
