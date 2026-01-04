import { DepartmentBarChart } from "@/components/charts/DepartmentBarChart";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { StatCard } from "@/components/cards/StatCard";
import { funnelStages, kpi, volunteerByDepartment } from "@/lib/demoData";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pill bg-emerald-100 text-emerald-900">Filtros rápidos</span>
        <div className="flex flex-wrap gap-2">
          {["Hoje", "Semana", "Mês", "Personalizado"].map((label) => (
            <button
              key={label}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Casados no período" value={kpi.casadosPeriodo} hint="Novos cadastros válidos" />
        <StatCard label="Encaminhados" value={kpi.encaminhados} hint="Fila de Novos Convertidos" />
        <StatCard label="Integrados" value={kpi.integrados} hint="Fluxo concluído" />
        <StatCard label="Batizados" value={kpi.batizados} hint="Consolidados ao batismo" />
        <StatCard label="Pessoas servindo" value={kpi.servindo} hint="Departamentos com voluntários" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart stages={funnelStages} />
        <DepartmentBarChart entries={volunteerByDepartment} />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-emerald-900">Destaques operacionais</h3>
            <p className="text-sm text-slate-600">
              Consolidados anuais aparecem apenas quando um relatório é gerado.
            </p>
          </div>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700">
            Registrar batismo rápido
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="card-muted card p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">Integração & contatos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">12</p>
            <p className="text-xs text-slate-500">últimos 7 dias</p>
          </div>
          <div className="card-muted card p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">Departamentos ativos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">7</p>
            <p className="text-xs text-slate-500">com pessoas servindo</p>
          </div>
          <div className="card-muted card p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">Batismos marcados</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">4</p>
            <p className="text-xs text-slate-500">próximos 30 dias</p>
          </div>
        </div>
      </div>
    </div>
  );
}
