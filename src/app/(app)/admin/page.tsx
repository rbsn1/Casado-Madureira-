export default function AdminPage() {
  const perfis = ["ADMIN_MASTER", "PASTOR", "SECRETARIA", "NOVOS_CONVERTIDOS", "LIDER_DEPTO", "VOLUNTARIO"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Governança</p>
          <h2 className="text-xl font-semibold text-emerald-900">Administração de Usuários</h2>
        </div>
        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Enviar convite
        </button>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Usuário</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">E-mail</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Perfil</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perfis.map((perfil) => (
                <tr key={perfil} className="hover:bg-emerald-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">{perfil} User</td>
                  <td className="px-4 py-3 text-slate-700">{perfil.toLowerCase()}@madureira.org</td>
                  <td className="px-4 py-3">
                    <span className="pill bg-emerald-100 text-emerald-900">{perfil}</span>
                  </td>
                  <td className="px-4 py-3 text-emerald-900">Ativo</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                        Editar
                      </button>
                      <button className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Desativar
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
