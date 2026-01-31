"use client";

import { FormEvent, useMemo, useState } from "react";

type FieldErrors = {
  email?: string;
  password?: string;
};

const initialErrors: FieldErrors = {};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>(initialErrors);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  function validate() {
    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = "Informe seu email.";
    if (!password.trim()) nextErrors.password = "Informe sua senha.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
    } catch {
      setFormError("Nao foi possivel autenticar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070A12] text-white">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.2), transparent 55%), linear-gradient(180deg, #0B1020, #070A12)"
        }}
      />

      <div className="absolute inset-0 opacity-[0.05]">
        {/* Pattern SVG overlay */}
        <svg className="h-full w-full" aria-hidden="true">
          <defs>
            <pattern id="ccm-pattern" width="120" height="120" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="white" strokeWidth="1">
                <path d="M20 30c4-6 12-6 16 0 4 6-4 14-8 18-4-4-12-12-8-18Z" />
                <circle cx="88" cy="30" r="10" />
                <circle cx="104" cy="30" r="10" />
                <path d="M96 30v14" />
                <path d="M58 84h6m-3-3v6" />
                <path d="M20 86c4 8 18 8 22 0" />
                <circle cx="20" cy="76" r="4" />
                <circle cx="42" cy="76" r="4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ccm-pattern)" />
        </svg>
      </div>

      <div className="absolute left-8 top-24 h-72 w-72 rounded-full bg-[#10B981]/20 blur-3xl ccm-blob-one" />
      <div className="absolute bottom-10 right-8 h-80 w-80 rounded-full bg-[#6366F1]/20 blur-3xl ccm-blob-two" />

      {/* Radial glow behind card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6366F1]/20 blur-3xl" />

      <main
        className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 3rem)"
        }}
      >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
              CCM
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Casados com a Madureira</p>
              <h1 className="text-2xl font-semibold text-white">Bem-vindos ao CCM</h1>
            </div>
          </div>

          <p className="mt-3 text-sm text-white/70">Acesso ao painel de departamentos</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/40"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                required
              />
              {errors.email ? (
                <p id="email-error" className="text-xs text-[#FCA5A5]">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/40"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                required
              />
              {errors.password ? (
                <p id="password-error" className="text-xs text-[#FCA5A5]">
                  {errors.password}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-[#6366F1] focus:ring-[#6366F1]"
                />
                Manter conectado
              </label>
              <button
                type="button"
                className="text-xs font-medium text-white/80 transition hover:text-white"
              >
                Esqueci minha senha
              </button>
            </div>

            {formError ? (
              <div
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs text-[#FCA5A5]"
                aria-live="polite"
              >
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="relative w-full rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#4F46E5] to-[#10B981] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>

      <style jsx>{`
        .ccm-blob-one {
          animation: floatOne 18s ease-in-out infinite;
        }
        .ccm-blob-two {
          animation: floatTwo 22s ease-in-out infinite;
        }
        @keyframes floatOne {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(20px, -30px, 0);
          }
        }
        @keyframes floatTwo {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(-24px, 18px, 0);
          }
        }
      `}</style>
    </div>
  );
}
