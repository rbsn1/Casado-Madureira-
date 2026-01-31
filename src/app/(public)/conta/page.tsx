"use client";

import Link from "next/link";
import { PortalBackground } from "@/components/layout/PortalBackground";

export default function ContaPage() {
  return (
    <PortalBackground heroImageSrc="/portal-hero.jpg" heroHeight="360px">
      {/* Substitua /public/portal-hero.jpg pela imagem final do mock. */}
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600/90 text-xs font-semibold text-white">
              CCM
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Portal CCM
              </p>
              <p className="text-sm font-semibold text-emerald-900">Minha conta</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-900"
          >
            Voltar ao portal →
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center pt-10">
          <div className="card max-w-xl p-6 text-center">
            <h1 className="text-2xl font-semibold text-emerald-900">Minha conta</h1>
            <p className="mt-2 text-sm text-slate-600">
              Esta area sera expandida em breve com informacoes do usuario.
            </p>
          </div>
        </section>
      </div>
    </PortalBackground>
  );
}
