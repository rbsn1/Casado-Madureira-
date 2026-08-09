"use client";

import { PortalBackground } from "@/components/layout/PortalBackground";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

export default function AcessoInternoPage() {
  return (
    <PortalBackground heroHeight="420px">
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
            <div className="mt-6">
              <LoginForm showRememberMe />
            </div>
          </Card>
        </section>
      </div>
    </PortalBackground>
  );
}
