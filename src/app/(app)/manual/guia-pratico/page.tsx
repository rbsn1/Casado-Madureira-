"use client";

import Link from "next/link";

export default function ManualGuiaPraticoPage() {
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-900">Manual Simples</p>
        <h2 className="mt-2 text-2xl font-semibold text-text">Guia Prático para Uso Diário</h2>
        <p className="mt-2 text-sm text-text-muted">
          Este manual foi feito para quem não é técnico. Siga os passos na ordem e use como consulta rápida no dia a
          dia.
        </p>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Antes de começar</h3>
        <div className="mt-3 space-y-2 text-sm text-text-muted">
          <p>1. Tenha seu e-mail e senha de acesso.</p>
          <p>2. Se aparecer mensagem de permissão, peça ao administrador para revisar seu perfil.</p>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Erros comuns e solução rápida</h3>
        <div className="mt-3 space-y-2 text-sm text-text-muted">
          <p>
            <strong>“not allowed”</strong>: seu perfil não tem permissão para esta ação.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Material complementar</h3>
        <p className="mt-2 text-sm text-text-muted">
          Se precisar da visão técnica completa de arquitetura e governança, abra o{" "}
          <Link href="/manual/jornada-completa" className="font-semibold text-brand-700 underline">
            Manual técnico (jornada completa)
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
