import { OriginImpactRow } from "./types";

function variationTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-500";
}

function variationLabel(absolute: number, pct: number | null) {
  if (pct === null) return `${absolute > 0 ? "+" : ""}${absolute} (—)`;
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  return `${absolute > 0 ? "+" : ""}${absolute} (${pct > 0 ? "+" : ""}${rounded}%)`;
}

export function DecisionsByOriginPanel({ rows }: { rows: OriginImpactRow[] }) {
  const hasData = rows.some((row) => row.current > 0);

  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Decisões por culto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-900">Por culto (no período)</h3>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">Cultos</span>
      </div>

      {!hasData ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Sem decisões no período.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <article key={row.origin} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{row.current}</span>
                  <span>{row.sharePct.toFixed(1)}%</span>
                  <span className={variationTone(row.variationPct)}>{variationLabel(row.variationAbs, row.variationPct)}</span>
                </div>
              </div>

              <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full bg-sky-600 transition-all"
                  style={{ width: `${Math.max(4, Math.min(100, row.sharePct))}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
