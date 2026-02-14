"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope, getDiscipuladoHomePath, isDiscipuladoScopedAccount } from "@/lib/authScope";

type LoginStatus = "idle" | "loading" | "error";

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

    const scope = await getAuthScope();
    const roles = scope.roles;
    const isGlobalAdmin = scope.isAdminMaster;
    const isDiscipuladoAccount = isDiscipuladoScopedAccount(roles, isGlobalAdmin);
    if (!isGlobalAdmin && roles.includes("CADASTRADOR")) {
      router.push("/discipulado/convertidos/novo");
      return;
    }
    if (isDiscipuladoAccount) {
      router.push(getDiscipuladoHomePath(roles));
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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Left Panel - Visual/Inspirational */}
      <div className="relative hidden flex-col justify-between bg-zinc-900 p-10 text-white lg:flex">
        <div className="absolute inset-0 z-0">
          <Image
            src="/discipulado-login-bg-2160x2700.webp"
            alt="Discipulado Background"
            fill
            className="object-cover opacity-60 mix-blend-overlay"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-zinc-900/10" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur text-sm font-bold text-white border border-white/20">
            DC
          </div>
          <span className="text-lg font-semibold tracking-wide text-white/90">Portal Discipulado</span>
        </div>

        <div className="relative z-10 max-w-md">
          <blockquote className="space-y-4">
            <p className="text-2xl font-medium leading-relaxed font-serif italic text-amber-50/90">
              &ldquo;Ide, portanto, fazei discípulos de todas as nações, batizando-os em nome do Pai, e do Filho, e do Espírito Santo.&rdquo;
            </p>
            <footer className="text-sm font-medium text-amber-200/80 uppercase tracking-wider">
              Mateus 28:19
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-col items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-24 xl:px-32">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="group flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:-translate-x-1"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar ao portal
            </Link>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Entrar no módulo</h1>
            <p className="text-slate-500">
              Acesse sua conta institucional para gerenciar o discipulado.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@casados.com"
                  value={emailValue}
                  onChange={(event) => setEmailValue(event.target.value)}
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700" htmlFor="password">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-sm font-medium text-sky-600 hover:text-sky-500 hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600"
              >
                Manter conectado
              </label>
            </div>

            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-sky-700 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-950 disabled:pointer-events-none disabled:opacity-50"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </>
              ) : "Entrar"}
            </button>

            {status === "error" && (
              <div className="group relative flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                <span>{message || "Ocorreu um erro ao tentar entrar."}</span>
              </div>
            )}

            {status === "idle" && message && (
              <div className="group relative flex w-full items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                <span>{message}</span>
              </div>
            )}
          </form>

          <p className="px-8 text-center text-sm text-slate-500">
            Ainda não tem acesso?{" "}
            <Link href="/contato" className="underline underline-offset-4 hover:text-primary">
              Entre em contato
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

