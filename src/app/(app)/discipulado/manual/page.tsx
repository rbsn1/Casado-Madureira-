"use client";

export default function DiscipuladoManualPage() {
  return (
    <div className="space-y-6">
      <section className="discipulado-panel p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Manual Simples</p>
        <h2 className="mt-2 text-2xl font-semibold text-sky-950">Guia prático do Discipulado</h2>
        <p className="mt-2 text-sm text-slate-600">
          Manual didático para uso diário, com linguagem simples e passos objetivos.
        </p>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">1. Primeiro acesso</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>1. Faça login no Portal Discipulado.</p>
          <p>2. Se seu perfil for ADMIN_DISCIPULADO, você entra direto no painel de Admin.</p>
          <p>3. Se seu perfil for de cadastro, você entra direto em Novo convertido.</p>
          <p>4. Se aparecer erro de permissão, peça ajuste de perfil ao administrador.</p>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">2. Cadastrar novo convertido</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>1. Abra a tela Novo convertido.</p>
          <p>2. Na aba Selecionar do CCM, escolha o membro na lista.</p>
          <p>3. Se o membro não existir, use Cadastrar no Discipulado.</p>
          <p>4. Clique em Criar case.</p>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">3. Fila do discipulado</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>1. A fila mostra os casos ordenados por prioridade.</p>
          <p>2. Use os filtros para ver ativos/pausados ou todos.</p>
          <p>3. Perfis de cadastro conseguem visualizar a fila para acompanhamento.</p>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">4. Progresso por módulos</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>1. No case, matricule o membro em um ou mais módulos.</p>
          <p>2. Atualize o status de cada módulo: Não iniciado, Em andamento ou Concluído.</p>
          <p>3. Salve observações para manter histórico do acompanhamento.</p>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">5. Dúvidas rápidas</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <strong>“not allowed”:</strong> falta permissão para a ação.
          </p>
          <p>
            <strong>“já existe case ativo”:</strong> o membro já está em acompanhamento.
          </p>
          <p>
            <strong>Membro não aparece:</strong> confirme se foi cadastrado no CCM da mesma congregação.
          </p>
        </div>
      </section>
    </div>
  );
}
