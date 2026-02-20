"use client";

import Link from "next/link";
import { type CSSProperties, FormEvent, ReactNode, useState } from "react";
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
  backgroundImage: "/bg-discipulado.webp",
  heroTop: "rgba(2, 6, 23, 0.75)",
  heroMiddle: "rgba(2, 6, 23, 0.55)",
  heroBottom: "rgba(2, 6, 23, 0.9)",
  rightOverlay: "0.88",
  noiseOpacity: "0.035",
  glassBlur: "22px",
  glowGold: "230 167 86"
} as const;

function FlameMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 7c5.7 9.5 15 15.2 15 27.8 0 10-6.7 17.2-15 17.2s-15-7.2-15-17.2c0-7.3 3.5-13 7.2-18.3C26.4 13.3 28.6 10.2 32 7z"
        fill="currentColor"
      />
    </svg>
  );
}

function BackgroundOverlay() {
  return (
    <>
      <div className={styles.backgroundImage} aria-hidden="true" />
      <div className={styles.backgroundOverlay} aria-hidden="true" />
      <div className={styles.backgroundFocus} aria-hidden="true" />
      <div className={styles.backgroundNoise} aria-hidden="true" />
    </>
  );
}

function VerseCard({ className = "" }: { className?: string }) {
  return (
    <article className={`${styles.verseCard} ${className}`}>
      <div className="flex items-center gap-2">
        <span className={styles.verseLabel}>Verso do dia</span>
        <span className={styles.verseRule} aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className={styles.flameDot} aria-hidden="true">
          <FlameMark className="h-4 w-4" />
        </span>
        <div>
          <p className="text-base leading-relaxed text-slate-100 lg:text-lg">
            “Ide, portanto, fazei discípulos de todas as nações...”
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
            Mateus 28:19
          </p>
        </div>
      </div>
    </article>
  );
}

function AuthGlassCard({ children }: { children: ReactNode }) {
  return <Card className={styles.authGlass}>{children}</Card>;
}

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
          "--discipulado-login-bg": `url("${LOGIN_TOKENS.backgroundImage}")`,
          "--login-hero-top": LOGIN_TOKENS.heroTop,
          "--login-hero-middle": LOGIN_TOKENS.heroMiddle,
          "--login-hero-bottom": LOGIN_TOKENS.heroBottom,
          "--discipulado-right-overlay": LOGIN_TOKENS.rightOverlay,
          "--discipulado-noise-opacity": LOGIN_TOKENS.noiseOpacity,
          "--discipulado-glass-blur": LOGIN_TOKENS.glassBlur,
          "--discipulado-gold-rgb": LOGIN_TOKENS.glowGold
        } as CSSProperties
      }
    >
      <BackgroundOverlay />

      <div className={styles.layout}>
        <section className={styles.heroPanel} aria-label="Contexto espiritual do discipulado">
          <div className={styles.heroInner}>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-amber-300">
                  <FlameMark className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-200/70">Portal</p>
                  <p className="text-lg font-semibold text-slate-100">Discipulado</p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-200/78">
                Ambiente institucional para acompanhar cada pessoa com cuidado, constância e direção.
              </p>
            </div>

            <div className="space-y-4">
              <VerseCard />
              <p className="max-w-[32rem] text-sm text-slate-200/72">
                Registre evolução, cuide de próximos passos e mantenha o discipulado em unidade.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.formPanel}>
          <AuthGlassCard>
            <CardHeader className="space-y-4 px-7 pb-4 pt-7 sm:px-10 sm:pb-5 sm:pt-10">
              <Link
                href="/login"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-200/88 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/25"
              >
                <ArrowLeft size={17} />
                Voltar ao portal
              </Link>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/90">
                  Portal Discipulado
                </p>
                <CardTitle className="text-[clamp(1.45rem,2.5vw,2rem)] font-semibold tracking-tight text-slate-50">
                  Acessar Módulo de Discipulado
                </CardTitle>
                <CardDescription className="max-w-lg text-sm leading-relaxed text-slate-200/86">
                  Entre com sua conta institucional para acompanhar pessoas, módulos e jornadas.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-7 pb-5 sm:px-10">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-100" htmlFor="email">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      aria-required="true"
                      aria-invalid={status === "error"}
                      placeholder="voce@casados.com"
                      value={emailValue}
                      onChange={(event) => setEmailValue(event.target.value)}
                      className={`h-12 pl-11 ${styles.inputField}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-100" htmlFor="password">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={status === "loading"}
                      className="text-xs font-medium text-slate-200/90 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/25 disabled:opacity-60"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={keepConnected ? "current-password" : "off"}
                      required
                      aria-required="true"
                      aria-invalid={status === "error"}
                      placeholder="••••••••"
                      className={`h-12 pl-11 pr-12 ${styles.inputField}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                      className={styles.passwordToggle}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="keep-connected" className="flex items-center gap-2 text-sm text-slate-100/95">
                    <Checkbox
                      id="keep-connected"
                      name="keep-connected"
                      checked={keepConnected}
                      onChange={(event) => setKeepConnected(event.currentTarget.checked)}
                      className={styles.checkboxField}
                    />
                    Manter conectado
                  </label>
                </div>

                <Button type="submit" className={styles.primaryButton} disabled={status === "loading"}>
                  {status === "loading" ? <span className={styles.spinner} aria-hidden="true" /> : null}
                  <span>{status === "loading" ? "Entrando..." : "Entrar no discipulado"}</span>
                </Button>

                {status === "error" ? (
                  <p role="alert" className={styles.statusError}>
                    {message || "Não foi possível entrar. Verifique suas credenciais."}
                  </p>
                ) : null}
                {status === "idle" && message ? (
                  <p role="status" aria-live="polite" className={styles.statusInfo}>
                    {message}
                  </p>
                ) : null}
              </form>
            </CardContent>

            <CardFooter className="flex-col px-7 pb-7 pt-0 sm:px-10 sm:pb-9">
              <p className="text-center text-sm text-slate-200/88">
                Ainda não tem acesso?{" "}
                <a
                  href="mailto:discipulado@casados.com?subject=Acesso%20Portal%20Discipulado"
                  className="font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-slate-100"
                >
                  Entre em contato
                </a>
              </p>
              <Separator className="my-4 bg-white/15" />
              <p className="text-center text-xs text-slate-300">© 2026 Discipulado Madureira</p>
            </CardFooter>
          </AuthGlassCard>

          <VerseCard className={styles.mobileVerse} />
        </section>
      </div>
    </main>
  );
}
