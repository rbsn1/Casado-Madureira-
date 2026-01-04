export default function PublicCadastroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-700">Casados com a Madureira</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-900">Cadastro de novos</h1>
          <p className="mt-2 text-sm text-slate-600">
            Mobile-first. Ao enviar, cria cadastro, registra na fila de integração e adiciona evento na timeline.
          </p>
        </div>

        <form className="card space-y-4 p-5">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome completo</span>
            <input
              required
              name="nome_completo"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="Digite seu nome"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Telefone (WhatsApp)</span>
            <input
              required
              name="telefone_whatsapp"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="(21) 99999-0000"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Origem</span>
            <input
              name="origem"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="Culto, landing page, indicação..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Data</span>
            <input
              name="data"
              type="date"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Observações</span>
            <textarea
              name="observacoes"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="Compartilhe mais detalhes"
            />
          </label>
          <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700">
            Enviar cadastro
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Ao enviar, cria pessoa, integra fila (status PENDENTE) e adiciona evento CADASTRO & ENCAMINHADO na timeline.
        </p>
      </div>
    </div>
  );
}
