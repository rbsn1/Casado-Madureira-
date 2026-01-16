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
        <div className="relative mt-6 grid grid-cols-12 items-end gap-2">
          {entries.map((entry) => (
            <button
              key={entry.month}
              type="button"
              onClick={() => onMonthClick(year, entry.month)}
              onMouseEnter={() => setHovered(entry.month)}
              onMouseLeave={() => setHovered(null)}
              className="group flex flex-col items-center gap-2"
            >
              <div className="relative flex h-28 w-full items-end rounded-full bg-tea-100/60">
                <div
                  className="w-full rounded-full bg-tea-600 transition group-hover:bg-tea-600"
                  style={{ height: `${(entry.count / max) * 100}%` }}
                />
                {hovered === entry.month ? (
                  <div className="absolute -top-9 left-1/2 w-24 -translate-x-1/2 rounded-lg border border-tea-100 bg-white px-2 py-1 text-[11px] text-tea-600 shadow">
                    {monthLabels[entry.month - 1]}: {entry.count}
                  </div>
                ) : null}
              </div>
              <span className="text-[11px] text-slate-500">{monthLabels[entry.month - 1]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
