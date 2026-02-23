import { ExecutiveKpiModel, ExecutiveKpiPeriod } from "./types";

const PERIOD_OPTIONS: Array<{ value: ExecutiveKpiPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" }
];

function variationTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-500";
}

function variationLabel(value: number | null) {
  if (value === null) return "vs período anterior: —";
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `vs período anterior: ${value > 0 ? "+" : ""}${rounded}%`;
}

export function ExecutiveKpiRow({
  period,
  onPeriodChange,
  metrics
}: {
  period: ExecutiveKpiPeriod;
  onPeriodChange: (value: ExecutiveKpiPeriod) => void;
  metrics: ExecutiveKpiModel;
}) {
  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="KPIs executivos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Visão executiva</h3>
          <p className="text-xs text-slate-600">Entrada, progresso, risco e capacidade do período.</p>
        </div>
        <div className="-mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="inline-flex min-w-max rounded-lg border border-sky-200 bg-white p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  period === option.value ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
                aria-pressed={period === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className="flex min-w-max gap-3 sm:grid sm:min-w-0 sm:grid-cols-2 xl:grid-cols-4">
          <article className="min-w-[14.5rem] rounded-xl border border-sky-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Novos convertidos</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.novosConvertidos}</p>
            <p className={`text-xs font-medium ${variationTone(metrics.variationPct)}`}>
              {variationLabel(metrics.variationPct)}
            </p>
          </article>

          <article className="min-w-[14.5rem] rounded-xl border border-sky-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tempo médio até 1º contato</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.tempoMedioPrimeiroContato ?? "—"}</p>
            <p className="text-xs text-slate-500">Casos com primeiro contato no período</p>
          </article>

          <article className="min-w-[14.5rem] rounded-xl border border-sky-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sem contato 7+ dias</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.semContatoSeteDias}</p>
            <p className="text-xs text-slate-500">Sem interação recente</p>
          </article>

          <article className="min-w-[14.5rem] rounded-xl border border-sky-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atrasados</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.atrasados}</p>
            <p className="text-xs text-slate-500">Fora do prazo interno</p>
          </article>
        </div>
      </div>
    </section>
  );
}
