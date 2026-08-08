"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type LoginStatus = "idle" | "loading" | "error";

export default function AcessoInternoPage() {
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
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="420px">
      {/* Substitua /public/hero-community.jpg pela imagem final do mock. */}
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16">
        <header className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-700 text-xs font-semibold text-white">
              CCM
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
                Portal CCM
              </p>
              <p className="text-sm font-semibold text-text">Acesso interno</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-brand-700 transition hover:text-brand-900"
          >
            Voltar ao portal →
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center pt-10">
          <Card className="w-full max-w-md p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Acesso interno
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-text">Entre no painel</h1>
            <p className="mt-2 text-sm text-text-muted">
              Utilize seu e-mail institucional para acompanhar cadastros, relatórios e times.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="email">
                  E-mail
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@casados.com"
                  value={emailValue}
                  onChange={(event) => setEmailValue(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="password">
                  Senha
                </label>
                <Input id="password" name="password" type="password" placeholder="••••••••" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
                <label className="flex items-center gap-2">
                  <Checkbox />
                  Manter conectado
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="font-semibold text-brand-700 hover:text-brand-900"
                >
                  Esqueci minha senha
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={status === "loading"}>
                {status === "loading" ? "Entrando..." : "Entrar"}
              </Button>
              {status === "error" ? (
                <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
                  {message || "Nao foi possivel entrar. Verifique suas credenciais."}
                </p>
              ) : null}
              {status === "idle" && message ? (
                <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
                  {message}
                </p>
              ) : null}
            </form>
          </Card>
        </section>
      </div>
    </PortalBackground>
  );
}
