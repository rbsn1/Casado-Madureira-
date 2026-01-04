import { departamentos } from "@/lib/demoData";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function DepartamentosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Voluntariado</p>
          <h2 className="text-xl font-semibold text-emerald-900">Departamentos</h2>
        </div>
        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Novo departamento
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {departamentos.map((dept) => (
          <div key={dept.nome} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{dept.nome}</p>
                <p className="text-sm text-slate-600">Responsável: {dept.responsavel}</p>
              </div>
              <StatusBadge value={dept.ativo ? "ATIVO" : "INATIVO"} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-700">{dept.membros} membros</p>
              <div className="flex gap-2">
                <button className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                  Editar
                </button>
                <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                  Gerir membros
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
