import { filaNovosConvertidos } from "@/lib/demoData";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function NovosConvertidosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Integração</p>
          <h2 className="text-xl font-semibold text-emerald-900">Fila de Novos Convertidos</h2>
        </div>
        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Atribuir responsável
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filaNovosConvertidos.map((item) => (
          <div key={item.nome} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                <p className="text-xs text-slate-600">Última atualização: {item.ultima}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>Responsável: {item.responsavel}</p>
              <div className="flex gap-2">
                <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                  Registrar contato
                </button>
                <button className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                  Mover status
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
