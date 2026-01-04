export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Relatórios e Exportações</p>
          <h2 className="text-xl font-semibold text-emerald-900">Relatórios</h2>
        </div>
        <div className="pill bg-emerald-100 text-emerald-900">
          Consolidado anual somente ao gerar relatório
        </div>
      </div>

      <div className="card p-5">
        <form className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Tipo de relatório</span>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none">
              <option>Integração & Batismo</option>
              <option>Voluntariado por departamento</option>
              <option>Cadastros (lista)</option>
              <option>Consolidado anual</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Período</span>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none">
              <option>Hoje</option>
              <option>Semana</option>
              <option>Mês</option>
              <option>Personalizado</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Ano (para consolidado anual)</span>
            <input
              type="number"
              min={2020}
              defaultValue={2026}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Formato</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-slate-700">
                <input type="checkbox" defaultChecked /> PDF
              </label>
              <label className="flex items-center gap-1 text-slate-700">
                <input type="checkbox" defaultChecked /> Excel/CSV
              </label>
            </div>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Gerar Relatório
            </button>
            <button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              Exportar PDF
            </button>
            <button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              Exportar Excel/CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
