"use client";

import { useMemo } from "react";
import { CadastrosComboChart } from "@/components/charts/cadastros-mensais/CadastrosComboChart";
import {
  RawChartEntry,
  calcAvg,
  calcMoMChange,
  findLastWithData,
  findPeak,
  normalizeMonthlyData
} from "@/components/charts/cadastros-mensais/utils";

type CadastrosMensaisCardProps = {
  data: RawChartEntry[];
  year: number;
  years: number[];
  onYearChange: (value: number) => void;
  onMonthSelect?: (month: number | null) => void;
  selectedMonth?: number | null;
  previousYearData?: RawChartEntry[];
};

export function CadastrosMensaisCard({
  data,
  year,
  years,
  onYearChange,
  onMonthSelect,
  selectedMonth = null,
  previousYearData
}: CadastrosMensaisCardProps) {
  const entries = useMemo(() => normalizeMonthlyData(data, year), [data, year]);

  const total = useMemo(() => entries.reduce((sum, entry) => sum + (entry.value ?? 0), 0), [entries]);
  const average = useMemo(() => calcAvg(total, 12), [total]);
  const peak = useMemo(() => findPeak(entries), [entries]);
  const lastWithData = useMemo(() => findLastWithData(entries), [entries]);

  const selectedEntry = useMemo(() => {
    if (selectedMonth === null) return null;
    const found = entries.find((entry) => entry.month === selectedMonth);
    if (!found || found.value === null) return null;
    return found;
  }, [entries, selectedMonth]);

  const previousYearTotal = useMemo(() => {
    if (!previousYearData?.length) return null;
    return normalizeMonthlyData(previousYearData, year - 1).reduce((sum, entry) => sum + (entry.value ?? 0), 0);
  }, [previousYearData, year]);

  const totalDiffText = useMemo(() => {
    if (previousYearTotal === null) return null;
    const diff = calcMoMChange(total, previousYearTotal);
    if (diff.direction === "none") return `— vs ${year - 1}`;
    const arrow = diff.direction === "up" ? "↑" : diff.direction === "down" ? "↓" : "→";
    return `${arrow} ${diff.text.replace(" vs mês anterior", "")} vs ${year - 1}`;
  }, [previousYearTotal, total, year]);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900">Cadastros recebidos (por mês)</h3>
          <p className="text-xs text-slate-500">Clique no mês para filtrar os cadastros.</p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="rounded-full bg-tea-100 px-3 py-1 font-medium text-tea-700"
            aria-label="Filtro de tipo: Cadastros"
          >
            Cadastros
          </button>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
            aria-label="Selecionar ano"
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-3">
          <div className="w-[180px] shrink-0 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700">Total {year}</p>
            <p className="text-2xl font-semibold text-emerald-950">{total}</p>
            <p className="text-[11px] text-slate-500">{totalDiffText ?? "—"}</p>
          </div>

          <div className="w-[180px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Pico</p>
            <p className="text-lg font-semibold text-slate-900">
              {peak.label} ({peak.value})
            </p>
            <p className="text-[11px] text-slate-500">Maior volume mensal</p>
          </div>

          <div className="w-[180px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Média mensal</p>
            <p className="text-lg font-semibold text-slate-900">{average.toFixed(1)}</p>
            <p className="text-[11px] text-slate-500">Distribuição anual</p>
          </div>
        </div>
      </div>

      {selectedEntry ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Filtrando: {selectedEntry.label} ({selectedEntry.value})
          </span>
          <button
            type="button"
            onClick={() => onMonthSelect?.(null)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            Limpar filtro
          </button>
        </div>
      ) : null}

      <CadastrosComboChart
        entries={entries}
        year={year}
        average={average}
        peak={{ month: peak.month, value: peak.value }}
        selectedMonth={selectedMonth}
        onMonthSelect={onMonthSelect}
      />

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
          Pico: {peak.label} ({peak.value})
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
          Média: {average.toFixed(1)}
        </span>
        {lastWithData ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
            Último com cadastro: {lastWithData.label} ({lastWithData.value})
          </span>
        ) : null}
      </div>
    </section>
  );
}
