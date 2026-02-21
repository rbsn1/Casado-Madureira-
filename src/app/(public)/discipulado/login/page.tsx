"use client";

import Link from "next/link";
import { type CSSProperties, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope, getDiscipuladoHomePath, isDiscipuladoScopedAccount } from "@/lib/authScope";
import styles from "./loginBackground.module.css";

type LoginStatus = "idle" | "loading" | "error";

const LOGIN_TOKENS = {
  primary: "#0B6AAE",
  primaryDeep: "#075985",
  offWhite: "#F8FAFC",
  neutral900: "#0F172A",
  neutral600: "#475569",
  heroTop: "rgba(2, 6, 23, 0.88)",
  heroMiddle: "rgba(15, 23, 42, 0.48)",
  heroBottom: "rgba(2, 6, 23, 0.92)"
} as const;

export default function DiscipuladoLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

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
    <main
      className={styles.page}
      style={
        {
          "--login-primary": LOGIN_TOKENS.primary,
          "--login-primary-deep": LOGIN_TOKENS.primaryDeep,
          "--login-off-white": LOGIN_TOKENS.offWhite,
          "--login-neutral-900": LOGIN_TOKENS.neutral900,
          "--login-neutral-600": LOGIN_TOKENS.neutral600,
          "--login-hero-top": LOGIN_TOKENS.heroTop,
          "--login-hero-middle": LOGIN_TOKENS.heroMiddle,
          "--login-hero-bottom": LOGIN_TOKENS.heroBottom
        } as CSSProperties
      }
    >
      <div className={styles.layout}>
        <section
          className={styles.heroPanel}
          aria-label="Mensagem inspiracional do discipulado"
        >
          <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-8 pt-7 sm:px-8 lg:px-10 lg:pb-10 lg:pt-9">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg font-bold text-white shadow-[0_8px_26px_-16px_rgba(15,23,42,0.85)] backdrop-blur">
                DC
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/75">Portal</p>
                <p className="text-2xl font-semibold text-white">Discipulado</p>
              </div>
            </div>

            <div className="max-w-2xl space-y-4">
              <article
                className={`${styles.quoteCard} ${styles.glow} border border-white/5 bg-ink-900/50 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl`}
              >
                <div className={`${styles.flameWrap} text-accent-500 drop-shadow-[0_12px_30px_rgba(230,167,86,0.35)]`}>
                  <span className={styles.lineGlow} aria-hidden="true" />
                  <svg className={styles.flame} viewBox="0 0 64 64" aria-hidden="true">
                    <path
                      d="M32 6c6 10 16 16 16 30 0 10-7 18-16 18s-16-8-16-18c0-8 4-14 8-20 2-3 4-6 8-10z"
                      fill="url(#flameGradient)"
                    />
                    <defs>
                      <linearGradient id="flameGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor="#FFD29A" />
                        <stop offset="0.55" stopColor="#FF9A3D" />
                        <stop offset="1" stopColor="#FF6A00" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <p className="text-[clamp(1.04rem,1.4vw,1.56rem)] font-medium leading-relaxed italic text-white/95">
                  “Ide, portanto, fazei discípulos de todas as nações...”
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">Mateus 28:19</p>
              </article>
              <p className="text-lg text-white/80">Acompanhe, registre e cuide de cada discípulo.</p>
            </div>
          </div>
        </section>

        <section className={styles.formPanel}>
          <Card className={`${styles.loginCard} text-slate-50`}>
            <CardHeader className="space-y-4 px-8 pb-4 pt-8 sm:px-10 sm:pb-5 sm:pt-10">
              <Link
                href="/login"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-100 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
              >
                <ArrowLeft size={18} />
                Voltar ao portal
              </Link>
              <div className="space-y-2">
                <CardTitle className="text-white drop-shadow-[0_1px_1px_rgba(2,6,23,0.45)]">Entrar no módulo</CardTitle>
                <CardDescription className="text-slate-100/95">
                  Acesse sua conta institucional para gerenciar o discipulado.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-5 sm:px-10">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-100" htmlFor="email">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                    />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="voce@casados.com"
                      value={emailValue}
                      onChange={(event) => setEmailValue(event.target.value)}
                      className={`h-12 pl-11 ${styles.input}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-100" htmlFor="password">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="text-sm font-medium text-slate-100 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                    />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={keepConnected ? "current-password" : "off"}
                      required
                      placeholder="••••••••"
                      className={`h-12 pl-11 pr-12 ${styles.input}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="keep-connected"
                    name="keep-connected"
                    checked={keepConnected}
                    onChange={(event) => setKeepConnected(event.currentTarget.checked)}
                  />
                  <label htmlFor="keep-connected" className="text-sm font-medium text-slate-100">
                    Manter conectado
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-800 text-white hover:bg-brand-900"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Acessando..." : "Acessar"}
                </Button>

                {status === "error" ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  >
                    {message || "Não foi possível entrar. Verifique suas credenciais."}
                  </p>
                ) : null}
                {status === "idle" && message ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700"
                  >
                    {message}
                  </p>
                ) : null}
              </form>
            </CardContent>

            <CardFooter className="flex-col px-8 pb-8 pt-0 sm:px-10 sm:pb-10">
              <p className="text-center text-sm text-slate-100">
                Ainda não tem acesso?{" "}
                <a
                  href="mailto:discipulado@casados.com?subject=Acesso%20Portal%20Discipulado"
                  className="font-semibold text-white underline decoration-white/55 underline-offset-4 transition-colors hover:text-slate-100"
                >
                  Entre em contato
                </a>
              </p>
              <Separator className="my-4" />
              <p className="text-center text-xs text-slate-200/90">© 2026 Discipulado Madureira</p>
            </CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
