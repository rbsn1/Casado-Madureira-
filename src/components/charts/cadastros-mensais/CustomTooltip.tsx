import { MoMChange } from "@/components/charts/cadastros-mensais/utils";

export function CustomTooltip({
  monthLabel,
  year,
  value,
  change,
  isPeak,
  leftPercent
}: {
  monthLabel: string;
  year: number;
  value: number;
  change: MoMChange;
  isPeak: boolean;
  leftPercent: number;
}) {
  const tone =
    change.direction === "up"
      ? "text-emerald-700"
      : change.direction === "down"
        ? "text-rose-700"
        : "text-slate-500";

  const arrow =
    change.direction === "up"
      ? "↑"
      : change.direction === "down"
        ? "↓"
        : "→";

  return (
    <div
      className="pointer-events-none absolute -top-3 z-20 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
      style={{ left: `${leftPercent}%`, transform: "translateX(-50%)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{monthLabel}/{year}</p>
      <p className="mt-1 text-lg font-semibold leading-none text-slate-900">{value} cadastros</p>
      <p className={`mt-1 text-xs font-medium ${tone}`}>
        {change.direction === "none" ? change.text : `${arrow} ${change.text}`}
      </p>
      {isPeak ? <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Pico do período</p> : null}
    </div>
  );
}
