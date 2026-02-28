"use client";

import Link from "next/link";
import { useState } from "react";

const palette = {
  bgStart: "#071428",
  bgEnd: "#0A1E36",
  primary: "#0A1E36",
  secondary: "#123A5B",
  textPrimary: "#E6EDF5",
  textSecondary: "rgba(230,237,245,0.65)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.10)",
  accent: "#B18C3D"
};

function PortalSeal() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.03]">
      <svg viewBox="0 0 48 48" className="h-8 w-8 text-white/80" fill="none">
        <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="1.2" />
        <path d="M17 24h14M24 17v14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function FormationVisual() {
  return (
    <div className="relative w-[320px]">
      <div className="absolute left-[148px] top-0 h-[118px] w-px bg-white/15" />
      {[0, 1, 2, 3].map((idx) => (
        <span
          key={idx}
          className="absolute left-[145px] h-[7px] w-[7px] rounded-full bg-white/70"
          style={{
            top: `${10 + idx * 34}px`,
            boxShadow: "0 0 0 5px rgba(230,237,245,0.05), 0 0 8px rgba(230,237,245,0.10)"
          }}
        />
      ))}

      <svg viewBox="0 0 320 210" className="relative mt-[86px] w-full">
        <path d="M74 142c24-22 58-24 82-16v46c-24-9-57-8-82 12z" fill="rgba(230,237,245,0.06)" stroke="rgba(230,237,245,0.72)" strokeWidth="2" />
        <path d="M246 142c-24-22-58-24-82-16v46c24-9 57-8 82 12z" fill="rgba(230,237,245,0.06)" stroke="rgba(230,237,245,0.72)" strokeWidth="2" />
        <path d="M160 126v46" stroke="rgba(230,237,245,0.6)" strokeWidth="2" />
        <path d="M102 157c16-10 33-12 54-9M218 157c-16-10-33-12-54-9" stroke="rgba(230,237,245,0.42)" strokeWidth="1.6" />
        <path d="M160 171c22-5 42 4 58 20" stroke="rgba(177,140,61,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function LoginPortalDiscipulado() {
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(120deg, ${palette.bgStart} 0%, ${palette.bgEnd} 100%)` }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(80% 75% at 50% 45%, rgba(194,214,236,0.08) 0%, rgba(7,20,40,0.18) 46%, rgba(3,9,20,0.82) 100%)"
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 28%, #fff 0.5px, transparent 1px), radial-gradient(circle at 73% 78%, #fff 0.5px, transparent 1px), radial-gradient(circle at 45% 58%, #fff 0.5px, transparent 1px)",
          backgroundSize: "140px 140px, 180px 180px, 220px 220px"
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 160px rgba(0,0,0,0.65)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1700px]">
        <section className="hidden flex-1 px-16 pb-12 pt-12 lg:flex">
          <div className="flex h-full w-full flex-col">
            <div className="flex items-start gap-4">
              <PortalSeal />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.34em] text-white/70">Portal Discipulado</p>
                <h1 className="mt-2 text-[44px] font-semibold leading-tight" style={{ color: palette.textPrimary }}>
                  Discipulado
                </h1>
                <p className="mt-2 text-sm" style={{ color: palette.textSecondary }}>
                  Formação e acompanhamento espiritual
                </p>
              </div>
            </div>

            <div className="mt-12 max-w-[620px]">
              <p className="text-[30px] leading-[1.25] text-[#DDE7F2]">
                Gerencie jornadas, módulos e crescimento de cada discípulo.
              </p>
            </div>

            <div className="mt-auto max-w-[620px]">
              <FormationVisual />

              <div
                className="mt-8 rounded-[20px] border p-6"
                style={{ borderColor: palette.border, background: "rgba(10,20,35,0.60)" }}
              >
                <p className="text-[22px] italic leading-[1.45]" style={{ color: "#E3EBF5" }}>
                  “Meus filhinhos, por quem de novo sinto as dores de parto, até ser Cristo formado em vós.”
                </p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Gálatas 4:19</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-4 py-10 lg:w-[46%] lg:justify-start lg:px-12">
          <div
            className="w-full max-w-[500px] rounded-[24px] border p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            style={{ borderColor: palette.border, background: "rgba(8,18,33,0.86)" }}
          >
            <Link href="/" className="inline-flex items-center text-sm text-white/70 transition hover:text-white">
              <span className="mr-2">←</span>
              Voltar ao portal
            </Link>

            <h2 className="mt-5 text-3xl font-semibold leading-tight" style={{ color: palette.textPrimary }}>
              Acessar Sistema de Discipulado
            </h2>
            <p className="mt-2 text-sm" style={{ color: palette.textSecondary }}>
              Acesse o painel de acompanhamento e formação.
            </p>

            <form className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-[#DCE7F3]">
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
                    className="h-12 w-full rounded-xl border border-slate-300/70 bg-slate-100/95 pl-10 pr-3 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/35"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm text-[#DCE7F3]">
                    Senha
                  </label>
                  <button type="button" className="text-xs text-white/70 transition hover:text-white">
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
                    className="h-12 w-full rounded-xl border border-slate-300/70 bg-slate-100/95 pl-10 pr-11 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/35"
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

              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={keepConnected}
                  onChange={(e) => setKeepConnected(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-[#123A5B] focus:ring-[#123A5B]/40"
                />
                Manter conectado
              </label>

              <button
                type="submit"
                className="h-12 w-full rounded-xl font-semibold text-white transition"
                style={{ backgroundColor: palette.secondary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#1A4A72";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = palette.secondary;
                }}
              >
                Acessar
              </button>
            </form>

            <div className="mt-7 border-t border-white/10 pt-5 text-center">
              <p className="text-sm" style={{ color: palette.textSecondary }}>
                Ainda não tem acesso?{" "}
                <button className="text-[#E6EDF5] underline underline-offset-4">Entre em contato</button>
              </p>
              <p className="mt-3 text-xs text-white/45">© 2026 Discipulado Madureira</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
