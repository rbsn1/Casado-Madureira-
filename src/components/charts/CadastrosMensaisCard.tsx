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
          <h3 className="text-sm font-semibold text-text">Cadastros recebidos (por mês)</h3>
          <p className="text-xs text-text-muted">Clique no mês para filtrar os cadastros.</p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-700"
            aria-label="Filtro de tipo: Cadastros"
          >
            Cadastros
          </button>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
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
          <div className="w-[180px] shrink-0 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-brand-700">Total {year}</p>
            <p className="text-2xl font-semibold text-brand-950">{total}</p>
            <p className="text-[11px] text-text-muted">{totalDiffText ?? "—"}</p>
          </div>

          <div className="w-[180px] shrink-0 rounded-xl border border-border bg-bg px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">Pico</p>
            <p className="text-lg font-semibold text-text">
              {peak.label} ({peak.value})
            </p>
            <p className="text-[11px] text-text-muted">Maior volume mensal</p>
          </div>

          <div className="w-[180px] shrink-0 rounded-xl border border-border bg-bg px-3 py-2 md:w-auto">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">Média mensal</p>
            <p className="text-lg font-semibold text-text">{average.toFixed(1)}</p>
            <p className="text-[11px] text-text-muted">Distribuição anual</p>
          </div>
        </div>
      </div>

      {selectedEntry ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
            Filtrando: {selectedEntry.label} ({selectedEntry.value})
          </span>
          <button
            type="button"
            onClick={() => onMonthSelect?.(null)}
            className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-medium text-text transition hover:border-brand-300 hover:text-text"
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
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-medium text-brand-800">
          Pico: {peak.label} ({peak.value})
        </span>
        <span className="rounded-full border border-border bg-bg px-3 py-1 font-medium text-text">
          Média: {average.toFixed(1)}
        </span>
        {lastWithData ? (
          <span className="rounded-full border border-border bg-bg px-3 py-1 font-medium text-text">
            Último com cadastro: {lastWithData.label} ({lastWithData.value})
          </span>
        ) : null}
      </div>
    </section>
  );
}
