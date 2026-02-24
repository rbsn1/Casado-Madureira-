import {
  EvangelisticImpactKpis,
  EvangelisticImpactPeriod
} from "./types";

const PERIOD_OPTIONS: Array<{ value: EvangelisticImpactPeriod; label: string }> = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" }
];

function formatVariation(absolute: number | null, pct: number | null) {
  if (absolute === null || pct === null) return "vs período anterior: —";
  const absoluteLabel = `${absolute > 0 ? "+" : ""}${absolute}`;
  const pctRounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  const pctLabel = `${pct > 0 ? "+" : ""}${pctRounded}%`;
  return `vs período anterior: ${absoluteLabel} (${pctLabel})`;
}

function variationTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-500";
}

function formatMedia(value: number | null) {
  if (value === null) return "—";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function EvangelisticImpactKpisSection({
  period,
  onPeriodChange,
  metrics
}: {
  period: EvangelisticImpactPeriod;
  onPeriodChange: (value: EvangelisticImpactPeriod) => void;
  metrics: EvangelisticImpactKpis;
}) {
  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Impacto Evangelístico">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Bloco estratégico</p>
          <h3 className="text-base font-semibold text-sky-900">Impacto Evangelístico</h3>
          <p className="text-xs text-slate-600">Mede decisões por período, média por culto e pico de impacto.</p>
        </div>

        <div className="-mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="inline-flex min-w-max rounded-lg border border-sky-200 bg-white p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-md px-3 py-2.5 text-xs font-semibold transition ${
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
        <div className="flex min-w-max gap-3 sm:grid sm:min-w-0 sm:grid-cols-3">
          <article className="min-w-[16rem] rounded-xl border border-emerald-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Aceitaram Jesus</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.aceitouJesusTotal}</p>
            <p className={`text-xs font-medium ${variationTone(metrics.aceitouJesusVariationPct)}`}>
              {formatVariation(metrics.aceitouJesusVariationAbs, metrics.aceitouJesusVariationPct)}
            </p>
          </article>

          <article className="min-w-[16rem] rounded-xl border border-sky-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Média por culto</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{formatMedia(metrics.mediaPorCulto)}</p>
            <p className={`text-xs font-medium ${variationTone(metrics.mediaPorCultoVariationPct)}`}>
              {formatVariation(metrics.mediaPorCultoVariationAbs, metrics.mediaPorCultoVariationPct)}
            </p>
          </article>

          <article className="min-w-[16rem] rounded-xl border border-indigo-100 bg-white p-3 sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Pico do período</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.pico?.total ?? "—"}</p>
            <p className="text-xs text-slate-600">
              {metrics.pico ? `${metrics.pico.dateLabel} • ${metrics.pico.cultoLabel}` : "Sem decisões no período"}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
