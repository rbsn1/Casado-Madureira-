"use client";

import Link from "next/link";
import { useState } from "react";

const TOKENS = {
  textPrimary: "#E6EDF5",
  textSecondary: "rgba(230,237,245,0.65)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.10)",
  cardBg: "rgba(10,20,35,0.56)",
  button: "#234A6B",
  buttonHover: "#2B587E",
  gold: "#C6A756"
};

function BrandSeal() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <svg viewBox="0 0 48 48" className="h-9 w-9 text-white/80" fill="none">
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.2" />
        <path d="M17 25h14M24 18v14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <text x="24" y="42" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.9">
          DISCIPULADO
        </text>
      </svg>
    </div>
  );
}

function BookCrossArt() {
  return (
    <div className="relative w-[280px]">
      <div
        className="pointer-events-none absolute left-1/2 top-[62%] h-28 w-44 -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(198,167,86,0.30) 0%, rgba(198,167,86,0.14) 35%, rgba(198,167,86,0.02) 75%)`,
          filter: "blur(16px)"
        }}
      />
      <svg viewBox="0 0 300 200" className="relative z-10 w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <g fill="none" stroke="rgba(230,237,245,0.78)" strokeWidth="2">
          <path d="M70 132c24-22 60-23 80-15v42c-22-8-56-8-80 11z" fill="rgba(230,237,245,0.06)" />
          <path d="M230 132c-24-22-60-23-80-15v42c22-8 56-8 80 11z" fill="rgba(230,237,245,0.06)" />
          <path d="M150 117v42" />
          <path d="M91 147c19-12 39-13 59-9M209 147c-19-12-39-13-59-9" stroke="rgba(230,237,245,0.48)" />
        </g>
        <g stroke="rgba(230,237,245,0.85)" strokeWidth="3" strokeLinecap="round">
          <path d="M150 52v38" />
          <path d="M136 67h28" />
        </g>
      </svg>
    </div>
  );
}

function ModuleRail() {
  return (
    <div className="pointer-events-none absolute bottom-[250px] left-2 top-24 hidden md:block">
      <div className="relative h-full w-8">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/70"
            style={{
              top: `calc(${(i * 100) / 3}% - 4px)`,
              boxShadow: "0 0 0 6px rgba(230,237,245,0.06), 0 0 12px rgba(230,237,245,0.12)"
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginDiscipuladoPremium() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ color: TOKENS.textPrimary }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, #070B14 0%, #0A1630 48%, #0D2742 100%)"
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.75]"
        style={{
          background:
            "radial-gradient(120% 95% at 50% 42%, rgba(255,255,255,0.06) 0%, rgba(2,6,18,0.28) 52%, rgba(2,5,14,0.82) 100%)"
        }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[42rem] -translate-x-1/2 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(170,198,230,0.16) 0%, rgba(120,162,210,0.06) 40%, rgba(12,25,45,0) 80%)"
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #ffffff 0.5px, transparent 1px), radial-gradient(circle at 70% 80%, #ffffff 0.5px, transparent 1px), radial-gradient(circle at 40% 60%, #ffffff 0.5px, transparent 1px), radial-gradient(circle at 80% 20%, #ffffff 0.4px, transparent 1px)",
          backgroundSize: "140px 140px, 170px 170px, 210px 210px, 120px 120px"
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.72)"
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1680px]">
        <div className="relative hidden flex-1 px-14 pb-10 pt-10 md:flex lg:px-16 xl:px-20">
          <ModuleRail />

          <div className="relative flex h-full w-full flex-col">
            <div className="flex items-start gap-4">
              <BrandSeal />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">PORTAL</p>
                <h1 className="mt-1 text-[46px] font-semibold leading-[1.04] text-[#ECF2F8]">Discipulado</h1>
                <p className="mt-3 text-sm" style={{ color: TOKENS.textSecondary }}>
                  Formando discípulos com propósito
                </p>
              </div>
            </div>

            <div className="mt-auto max-w-[620px]">
              <div className="mb-3">
                <BookCrossArt />
              </div>

              <div
                className="relative rounded-3xl border p-6 backdrop-blur-md"
                style={{
                  borderColor: TOKENS.border,
                  background: "rgba(10,20,35,0.55)"
                }}
              >
                <div className="mb-5 flex items-center justify-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.03]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" fill="none">
                      <path
                        d="M12 3c-2.8 3.4-5.4 5.9-5.4 9.3A5.4 5.4 0 0 0 12 17.7a5.4 5.4 0 0 0 5.4-5.4C17.4 8.9 14.8 6.4 12 3Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <p className="text-[26px] font-light italic leading-[1.36] text-[#ECF2F8]">
                  “Meus filhinhos, por quem de novo sinto as dores de parto, até ser Cristo formado em vós.”
                </p>
                <p className="mt-5 text-xs font-semibold tracking-[0.34em] text-white/65">GÁLATAS 4:19</p>
              </div>

              <p className="mt-4 text-sm" style={{ color: TOKENS.textSecondary }}>
                Acompanhe, registre e cuide de cada discípulo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-4 py-10 md:w-[52%] md:justify-end md:px-10 md:py-0 lg:px-16">
          <div className="w-full max-w-[520px] md:-translate-y-6">
            <div
              className="rounded-[28px] border p-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8"
              style={{
                borderColor: TOKENS.border,
                background: TOKENS.cardBg
              }}
            >
              <Link href="/" className="inline-flex items-center text-sm text-white/70 transition hover:text-white">
                <span className="mr-2">←</span>
                Voltar ao portal
              </Link>

              <h2 className="mt-5 text-3xl font-semibold leading-tight text-[#ECF2F8] md:text-[34px]">
                Acessar Painel do Discipulado
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: TOKENS.textSecondary }}>
                Acesse o sistema de acompanhamento e formação espiritual.
              </p>

              <form className="mt-7 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm text-[#E6EDF5]">
                    E-mail
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                        <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.6" />
                        <path d="m5 7 7 6 7-6" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      placeholder="voce@casados.com"
                      className="h-12 w-full rounded-xl border border-slate-300/70 bg-slate-100/95 pl-10 pr-3 text-[15px] text-slate-800 placeholder:text-slate-500 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-400/35"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm text-[#E6EDF5]">
                      Senha
                    </label>
                    <button
                      type="button"
                      className="text-xs text-white/70 transition hover:text-white"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-xl border border-slate-300/70 bg-slate-100/95 pl-10 pr-11 text-[15px] text-slate-800 placeholder:text-slate-500 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-400/35"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                          <path
                            d="M3 4.5 20 21M10.6 10.9A2 2 0 0 0 13.3 13M9.9 5.2A10.2 10.2 0 0 1 12 5c6.6 0 9.8 7 9.8 7a14.7 14.7 0 0 1-3.4 4.2M6.4 7.2A14.5 14.5 0 0 0 2.2 12S5.4 19 12 19a9.8 9.8 0 0 0 3-.4"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                          <path
                            d="M2.2 12S5.4 5 12 5s9.8 7 9.8 7-3.2 7-9.8 7S2.2 12 2.2 12Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-transparent text-[#2B587E] focus:ring-[#2B587E]/40"
                  />
                  Manter conectado
                </label>

                <button
                  type="submit"
                  className="h-12 w-full rounded-xl font-semibold text-white transition"
                  style={{ backgroundColor: TOKENS.button }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = TOKENS.buttonHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = TOKENS.button;
                  }}
                >
                  Acessar
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-5 text-center">
                <p className="text-sm" style={{ color: TOKENS.textSecondary }}>
                  Ainda não tem acesso? <button className="text-[#E6EDF5] underline underline-offset-4">Entre em contato</button>
                </p>
                <p className="mt-3 text-xs text-white/45">© 2026 Discipulado Madureira</p>
              </div>
            </div>

            <div className="mt-6 text-center md:hidden">
              <p className="text-sm" style={{ color: TOKENS.textSecondary }}>
                ...até ser Cristo formado em vós.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
