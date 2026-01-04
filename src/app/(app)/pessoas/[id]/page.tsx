import { timeline } from "@/lib/demoData";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function PessoaPerfilPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Perfil da Pessoa</p>
          <h2 className="text-xl font-semibold text-emerald-900">Ana Souza</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Marcar Integrado
          </button>
          <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
            Registrar Batismo
          </button>
          <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
            Vincular Depto
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-emerald-900">Dados gerais</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Telefone (WhatsApp)</dt>
              <dd className="text-sm font-semibold text-slate-900">(21) 99999-0000</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Origem</dt>
              <dd className="text-sm font-semibold text-slate-900">Culto Domingo</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Data</dt>
              <dd className="text-sm font-semibold text-slate-900">04/01/2026</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Status integração</dt>
              <dd className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <StatusBadge value="ENCAMINHADO" />
                <span className="text-xs text-slate-600">Responsável: Pr. Daniel</span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Integração</p>
              <p className="text-sm text-slate-700">Responsável: Pr. Daniel</p>
              <p className="text-xs text-slate-500">Desde 04/01/2026</p>
            </div>
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Batismo</p>
              <p className="text-sm text-slate-700">Marcado para 10/02/2026</p>
              <p className="text-xs text-slate-500">Secretaria</p>
            </div>
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Departamentos</p>
              <p className="text-sm text-slate-700">Kids (Voluntário) • desde 2025</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Timeline</h3>
            <button className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
              Registrar evento
            </button>
          </div>
          <ol className="mt-3 space-y-3">
            {timeline.map((event) => (
              <li key={event.descricao} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{event.data}</span>
                  <StatusBadge value={event.tipo} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{event.descricao}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
