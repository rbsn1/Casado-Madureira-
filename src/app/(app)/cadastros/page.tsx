import Link from "next/link";
import { pessoas } from "@/lib/demoData";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function CadastrosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Gestão de Pessoas</p>
          <h2 className="text-xl font-semibold text-emerald-900">Cadastros</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Exportar CSV
          </button>
          <button className="rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
            Importar CSV/XLSX
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar por nome, telefone ou origem"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none md:w-80"
          />
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none">
            <option>Todos os status</option>
            <option>PENDENTE</option>
            <option>ENCAMINHADO</option>
            <option>INTEGRADO</option>
            <option>BATIZADO</option>
          </select>
          <button className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
            Filtrar
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "Telefone", "Origem", "Status", "Responsável", "Atualizado em", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pessoas.map((pessoa) => (
                <tr key={pessoa.id} className="hover:bg-emerald-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <Link href={`/pessoas/${pessoa.id}`} className="hover:underline">
                      {pessoa.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.telefone}</td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.origem}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={pessoa.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.responsavel}</td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.atualizadoEm}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                        Editar
                      </button>
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                        Timeline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
