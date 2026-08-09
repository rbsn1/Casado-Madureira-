"use client";

import Link from "next/link";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { LoginForm } from "@/components/auth/LoginForm";

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-6 shadow-lg shadow-black/5 backdrop-blur";

export default function LoginPage() {
  return (
    <PortalBackground heroHeight="420px">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/90 text-sm font-semibold text-white">
            CCM
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              Portal CCM
            </p>
            <p className="text-sm font-semibold text-brand-900">Casados com a Madureira</p>
          </div>
        </div>

        <div className={cardClass}>
          <h1 className="text-2xl font-semibold text-brand-900">Entrar</h1>
          <p className="mt-2 text-sm text-text-muted">
            Utilize seu e-mail institucional para acessar o painel.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          <Link href="/agenda" className="font-semibold text-brand-800 hover:text-brand-900">
            Ver agenda
          </Link>
          {" · "}
          <Link href="/cadastro" className="font-semibold text-brand-800 hover:text-brand-900">
            Cadastro
          </Link>
        </p>
      </div>
    </PortalBackground>
  );
}
