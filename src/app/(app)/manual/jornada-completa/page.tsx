"use client";

const mindMap = `PORTAL CCM + DISCIPULADO (JORNADA COMPLETA)
├─ 1) Entrada no Sistema
│  ├─ Login público (CCM)
│  ├─ Login interno (/acesso-interno)
│  └─ Login discipulado (/discipulado/login)
├─ 2) Captação (CCM é fonte única)
│  ├─ Cadastro de pessoa no CCM
│  ├─ Regras de deduplicação/idempotência
│  └─ Encaminhamento para acompanhamento inicial
├─ 3) Operação Interna CCM
│  ├─ Cadastros e filtros
│  ├─ Timeline e contato
│  ├─ Batismos e relatórios
│  └─ Departamentos (com regra de elegibilidade)
├─ 4) Discipulado (módulo separado)
│  ├─ Novo convertido (usa membro já existente)
│  ├─ Abertura de case
│  ├─ Progresso por módulos obrigatórios
│  ├─ Pausa, retomada e conclusão
│  └─ Dashboard de acompanhamento
├─ 5) Governança Multi-congregação
│  ├─ congregation_id em dados críticos
│  ├─ RLS por congregação
│  └─ Admin geral com visão global
├─ 6) Perfis e Segurança
│  ├─ CADASTRADOR (cadastro operacional)
│  ├─ DISCIPULADOR (gestão do discipulado)
│  ├─ SM_DISCIPULADO (escopo restrito, se ativo)
│  └─ ADMIN_MASTER / SUPER_ADMIN (governança)
└─ 7) Ciclo de Qualidade
   ├─ Auditoria de trilha e status
   ├─ Métricas de desempenho
   ├─ Revisão de acessos por congregação
   └─ Melhoria contínua do funil`;

export default function ManualJornadaCompletaPage() {
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-900">Manual Operacional</p>
        <h2 className="mt-2 text-2xl font-semibold text-text">Jornada Completa do Sistema</h2>
        <p className="mt-2 text-sm text-text-muted">
          Guia de referência do Portal CCM + Discipulado para operação diária, gestão por perfil e escala por
          congregação.
        </p>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Mapa Mental (Visão Geral)</h3>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-4 text-xs leading-6 text-text">
          {mindMap}
        </pre>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Fluxo Ponta a Ponta</h3>
        <div className="mt-4 space-y-4 text-sm text-text-muted">
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">1. Entrada e autenticação</p>
            <p className="mt-1">
              Usuários entram pelas rotas de login. O sistema identifica os perfis e aplica o redirecionamento para o
              ambiente correto (CCM, Discipulado ou painel de cadastro).
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">2. Cadastro oficial de membros (CCM)</p>
            <p className="mt-1">
              Todo membro nasce no CCM. O formulário público/interno alimenta a base única de pessoas, com controle de
              deduplicação e rastreabilidade.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">3. Acompanhamento interno e departamentos</p>
            <p className="mt-1">
              A equipe acompanha timeline, status, encaminhamentos e departamentos. A elegibilidade para departamentos
              considera a conclusão do discipulado quando exigido.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">4. Jornada do discipulado</p>
            <p className="mt-1">
              O módulo de Discipulado cria um case para membro existente, abre progresso por módulos, registra notas e
              controla pausa, retomada e conclusão.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-text">5. Governança e escala</p>
            <p className="mt-1">
              Dados segregados por congregação com RLS e gestão central para sede. O modelo suporta expansão para
              múltiplas congregações mantendo isolamento e auditoria.
            </p>
          </article>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-text">Matriz Rápida por Perfil</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text">
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">Acesso principal</th>
                <th className="px-3 py-2">Responsabilidade</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-medium text-text">CADASTRADOR</td>
                <td className="px-3 py-2">Cadastro e operação de entrada</td>
                <td className="px-3 py-2">Garantir qualidade da captação inicial</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-medium text-text">DISCIPULADOR</td>
                <td className="px-3 py-2">Dashboard e convertidos do discipulado</td>
                <td className="px-3 py-2">Conduzir progresso e conclusão dos módulos</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-medium text-text">SM_DISCIPULADO</td>
                <td className="px-3 py-2">Escopo disciplinado conforme regra vigente</td>
                <td className="px-3 py-2">Suporte operacional controlado</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-medium text-text">ADMIN_MASTER / SUPER_ADMIN</td>
                <td className="px-3 py-2">Visão global (CCM + Discipulado)</td>
                <td className="px-3 py-2">Governança, auditoria e liberação de acessos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
