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
          <p>2. Confira se está no ambiente correto: CCM ou Discipulado.</p>
          <p>3. Se aparecer mensagem de permissão, peça ao administrador para revisar seu perfil.</p>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Passo a passo (Discipulado)</h3>
        <div className="mt-4 space-y-4 text-sm text-text-muted">
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">1. Entrar no sistema</p>
            <p className="mt-1">Faça login e abra o menu do Discipulado.</p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">2. Cadastrar novo convertido</p>
            <p className="mt-1">Vá em <strong>Novo convertido</strong> e escolha uma das opções:</p>
            <p className="mt-1">1. Selecionar um membro já cadastrado no CCM.</p>
            <p>2. Cadastrar direto no formulário do Discipulado.</p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">3. Criar o case de discipulado</p>
            <p className="mt-1">
              Depois de escolher ou cadastrar o membro, clique em <strong>Criar case</strong>.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">4. Matricular em módulos</p>
            <p className="mt-1">
              No detalhe do membro, use a área <strong>Matrícula em módulos</strong>. O mesmo membro pode ser
              matriculado em mais de um módulo.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">5. Atualizar status de cada módulo</p>
            <p className="mt-1">
              Para cada módulo, escolha o status (<strong>Não iniciado</strong>, <strong>Em andamento</strong> ou{" "}
              <strong>Concluído</strong>) e clique em <strong>Salvar status</strong>.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">6. Registrar observações e contatos</p>
            <p className="mt-1">
              Salve observações no módulo e registre tentativas de contato. Isso ajuda no acompanhamento e na
              criticidade.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">7. Finalizar o discipulado</p>
            <p className="mt-1">
              Use <strong>Concluir discipulado</strong> somente quando todos os módulos estiverem concluídos.
            </p>
          </article>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Perfis e o que cada um faz</h3>
        <div className="mt-3 space-y-2 text-sm text-text-muted">
          <p>
            <strong>DISCIPULADOR</strong>: visão completa do Discipulado.
          </p>
          <p>
            <strong>SM_DISCIPULADO</strong>: foco em cadastro e apoio operacional.
          </p>
          <p>
            <strong>SECRETARIA_DISCIPULADO</strong>: foco em cadastro e apoio operacional.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Erros comuns e solução rápida</h3>
        <div className="mt-3 space-y-2 text-sm text-text-muted">
          <p>
            <strong>“not allowed”</strong>: seu perfil não tem permissão para esta ação.
          </p>
          <p>
            <strong>“já existe case ativo”</strong>: este membro já está em acompanhamento.
          </p>
          <p>
            <strong>“congregação sem módulos ativos”</strong>: acione o administrador do discipulado.
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
