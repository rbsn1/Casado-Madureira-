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
    const top = 5;
    const bottom = 38;
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
    const start = `M ${points[0].x} 40`;
    const line = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
    const end = `L ${points[points.length - 1].x} 40 Z`;
    return `${start} ${line} ${end}`;
  }, [points]);
  const hoveredPoint = hovered ? points.find((point) => point.month === hovered) : null;

  return (
    <div className="card p-6">
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
        <p className="mt-4 text-sm text-slate-500">Sem dados para o ano selecionado.</p>
      ) : (
        <div className="relative mt-5">
          <div className="relative h-52 w-full md:h-56 lg:h-60">
            <svg viewBox="0 0 100 44" className="h-full w-full">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#areaGradient)" />
              {hoveredPoint ? (
                <line
                  x1={hoveredPoint.x}
                  y1={4}
                  x2={hoveredPoint.x}
                  y2={40}
                  stroke="rgba(16,185,129,0.24)"
                  strokeWidth="0.5"
                  strokeDasharray="1.4 1.6"
                />
              ) : null}
              <path d={linePath} fill="none" stroke="rgba(5,150,105,0.2)" strokeWidth="3.1" />
              <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.2" />
              {points.map((point) => (
                <circle
                  key={point.month}
                  cx={point.x}
                  cy={point.y}
                  r={hovered === point.month ? 1.9 : 1.15}
                  fill={hovered === point.month ? "#059669" : "rgba(16,185,129,0.72)"}
                  onMouseEnter={() => setHovered(point.month)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </svg>
            {hoveredPoint ? (
              <div
                className="absolute -top-8 rounded-xl border border-slate-200/85 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-tea-700 shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur-sm transition-all duration-200"
                style={{ left: `${hoveredPoint.x}%`, transform: "translateX(-50%) translateY(0)" }}
              >
                {monthLabels[hoveredPoint.month - 1]}: {hoveredPoint.count}
              </div>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-12 gap-1 text-[11px] text-slate-500">
            {entries.map((entry) => (
              <button
                key={entry.month}
                type="button"
                onClick={() => onMonthClick(year, entry.month)}
                onMouseEnter={() => setHovered(entry.month)}
                onMouseLeave={() => setHovered(null)}
                className="rounded-md py-1 text-center transition-colors duration-150 hover:bg-tea-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
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
