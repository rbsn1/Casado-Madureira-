import { useMemo, useState } from "react";

type MonthlyEntry = { month: number; count: number };

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthlyRegistrationsChart({
  entries,
  year,
  years,
  onYearChange,
  onMonthClick
}: {
  entries: MonthlyEntry[];
  year: number;
  years: number[];
  onYearChange: (value: number) => void;
  onMonthClick: (year: number, month: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = useMemo(() => Math.max(...entries.map((e) => e.count), 1), [entries]);
  const total = useMemo(() => entries.reduce((acc, item) => acc + item.count, 0), [entries]);
  const points = useMemo(() => {
    const top = 6;
    const bottom = 34;
    const range = bottom - top;
    return entries.map((entry, index) => {
      const x = entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100;
      const y = bottom - (entry.count / max) * range;
      return { x, y, month: entry.month, count: entry.count };
    });
  }, [entries, max]);
  const linePath = useMemo(() => {
    if (!points.length) return "";
    return points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }, [points]);
  const areaPath = useMemo(() => {
    if (!points.length) return "";
    const start = `M ${points[0].x} 34`;
    const line = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
    const end = `L ${points[points.length - 1].x} 34 Z`;
    return `${start} ${line} ${end}`;
  }, [points]);
  const hoveredPoint = hovered ? points.find((point) => point.month === hovered) : null;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900">Cadastros recebidos (por mês)</h3>
          <p className="text-xs text-slate-500">Clique no mês para filtrar os cadastros.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-tea-100 px-3 py-1 font-medium text-tea-600">Cadastros</span>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sem dados para o período selecionado.</p>
      ) : (
        <div className="relative mt-5">
          <div className="relative h-32 w-full">
            <svg viewBox="0 0 100 40" className="h-full w-full">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#areaGradient)" />
              <path d={linePath} fill="none" stroke="#10b981" strokeWidth="1.6" />
              {points.map((point) => (
                <circle
                  key={point.month}
                  cx={point.x}
                  cy={point.y}
                  r={hovered === point.month ? 2.6 : 1.8}
                  fill="#10b981"
                />
              ))}
            </svg>
            {hoveredPoint ? (
              <div
                className="absolute -top-6 rounded-lg border border-tea-100 bg-white px-2 py-1 text-[11px] text-tea-600 shadow"
                style={{ left: `${hoveredPoint.x}%`, transform: "translateX(-50%)" }}
              >
                {monthLabels[hoveredPoint.month - 1]}: {hoveredPoint.count}
              </div>
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-12 gap-1 text-[11px] text-slate-500">
            {entries.map((entry) => (
              <button
                key={entry.month}
                type="button"
                onClick={() => onMonthClick(year, entry.month)}
                onMouseEnter={() => setHovered(entry.month)}
                onMouseLeave={() => setHovered(null)}
                className="rounded-md py-1 text-center hover:bg-tea-100/60"
              >
                {monthLabels[entry.month - 1]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
