"use client";

import { CSSProperties, useId, useMemo, useState } from "react";

type ChartEntry = {
  month: number;
  label: string;
  value: number;
};

const defaultMonthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Chart tuning constants
export const HEIGHT_DESKTOP = 220;
export const HEIGHT_MOBILE = 180;
export const GRID_LINES = 4;
export const AREA_OPACITY = 0.07;
export const STROKE_WIDTH = 1.05;

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;
const plotTop = 5.4;
const plotBottom = 32.8;
const plotHeight = plotBottom - plotTop;

function sanitizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function formatVariation(current: number, previous: number | null) {
  if (previous === null || previous <= 0) {
    return { text: "—", tone: "text-slate-500" };
  }

  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  const signed = `${pct > 0 ? "+" : ""}${rounded}%`;

  if (pct > 0) return { text: signed, tone: "text-emerald-700" };
  if (pct < 0) return { text: signed, tone: "text-rose-700" };
  return { text: signed, tone: "text-slate-500" };
}

export function MonthlyRegistrationsChart({
  data,
  year,
  years,
  onYearChange,
  onMonthSelect,
  selectedMonth = null,
  previousYearData
}: {
  data: ChartEntry[];
  year: number;
  years: number[];
  onYearChange: (value: number) => void;
  onMonthSelect?: (month: number | null) => void;
  selectedMonth?: number | null;
  previousYearData?: ChartEntry[];
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const normalizedData = useMemo(() => {
    const byMonth = new Map<number, ChartEntry>();
    data.forEach((item) => byMonth.set(item.month, item));

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const source = byMonth.get(month);
      return {
        month,
        label: source?.label ?? defaultMonthLabels[index],
        value: sanitizeNumber(source?.value)
      };
    });
  }, [data]);

  const normalizedPreviousData = useMemo(() => {
    if (!previousYearData?.length) return null;
    const byMonth = new Map<number, ChartEntry>();
    previousYearData.forEach((item) => byMonth.set(item.month, item));
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const source = byMonth.get(month);
      return {
        month,
        label: source?.label ?? defaultMonthLabels[index],
        value: sanitizeNumber(source?.value)
      };
    });
  }, [previousYearData]);

  const total = useMemo(() => normalizedData.reduce((acc, item) => acc + item.value, 0), [normalizedData]);
  const peak = useMemo(
    () => normalizedData.reduce((best, item) => (item.value > best.value ? item : best), normalizedData[0]),
    [normalizedData]
  );
  const average = useMemo(() => total / normalizedData.length, [total, normalizedData.length]);

  const maxValue = useMemo(() => {
    const previousMax = normalizedPreviousData
      ? Math.max(...normalizedPreviousData.map((item) => item.value), 0)
      : 0;
    return Math.max(Math.max(...normalizedData.map((item) => item.value), 0), previousMax, 1);
  }, [normalizedData, normalizedPreviousData]);

  const currentPoints = useMemo(() => {
    return normalizedData.map((entry, index): ChartEntry & { x: number; y: number; prevValue: number | null } => {
      const x = (index / (normalizedData.length - 1)) * 100;
      const y = plotBottom - (entry.value / maxValue) * plotHeight;
      const prevValue = index > 0 ? normalizedData[index - 1].value : null;
      return { ...entry, x, y, prevValue };
    });
  }, [normalizedData, maxValue]);

  const previousPoints = useMemo(() => {
    if (!normalizedPreviousData) return [];
    return normalizedPreviousData.map((entry, index) => {
      const x = (index / (normalizedPreviousData.length - 1)) * 100;
      const y = plotBottom - (entry.value / maxValue) * plotHeight;
      return { ...entry, x, y };
    });
  }, [normalizedPreviousData, maxValue]);

  const currentLinePath = useMemo(() => {
    if (!currentPoints.length) return "";
    return currentPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }, [currentPoints]);

  const previousLinePath = useMemo(() => {
    if (!previousPoints.length) return "";
    return previousPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }, [previousPoints]);

  const areaPath = useMemo(() => {
    if (!currentPoints.length) return "";
    const start = `M ${currentPoints[0].x} ${plotBottom}`;
    const lines = currentPoints.map((point) => `L ${point.x} ${point.y}`).join(" ");
    const end = `L ${currentPoints[currentPoints.length - 1].x} ${plotBottom} Z`;
    return `${start} ${lines} ${end}`;
  }, [currentPoints]);

  const hoveredPoint = useMemo(
    () => (hoveredMonth ? currentPoints.find((point) => point.month === hoveredMonth) ?? null : null),
    [hoveredMonth, currentPoints]
  );

  const selectedPoint = useMemo(
    () => (selectedMonth ? currentPoints.find((point) => point.month === selectedMonth) ?? null : null),
    [selectedMonth, currentPoints]
  );

  const activePoint = hoveredPoint ?? selectedPoint;

  const activeVariation = useMemo(() => {
    if (!activePoint) return null;
    return formatVariation(activePoint.value, activePoint.prevValue);
  }, [activePoint]);

  const hasPreviousLine = useMemo(
    () => Boolean(normalizedPreviousData?.some((item) => item.value > 0)),
    [normalizedPreviousData]
  );

  const averageY = useMemo(
    () => plotBottom - (average / maxValue) * plotHeight,
    [average, maxValue]
  );

  const peakPoint = useMemo(
    () => currentPoints.find((point) => point.month === peak.month) ?? currentPoints[0] ?? null,
    [currentPoints, peak.month]
  );

  const lastNonZeroPoint = useMemo(() => {
    const found = [...currentPoints].reverse().find((point) => point.value > 0) ?? null;
    if (!found || !peakPoint) return found;
    const conflict = Math.abs(found.x - peakPoint.x) < 10 && Math.abs(found.y - peakPoint.y) < 6;
    return conflict ? null : found;
  }, [currentPoints, peakPoint]);

  const chartHeightVars = useMemo(
    () =>
      ({
        "--chart-height-mobile": `${HEIGHT_MOBILE}px`,
        "--chart-height-desktop": `${HEIGHT_DESKTOP}px`
      } as CSSProperties),
    []
  );

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Total {year}</p>
          <p className="text-lg font-semibold text-emerald-950">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pico</p>
          <p className="text-sm font-semibold text-slate-800">
            {peak.label} ({peak.value})
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Média mensal</p>
          <p className="text-sm font-semibold text-slate-800">{average.toFixed(1)}</p>
        </div>
      </div>

      {selectedPoint ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Filtrando: {selectedPoint.label} ({selectedPoint.value})
          </span>
          <button
            type="button"
            onClick={() => onMonthSelect?.(null)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          >
            Limpar filtro
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
          Pico: {peak.label} ({peak.value})
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
          Média: {average.toFixed(1)}
        </span>
        {lastNonZeroPoint ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
            Último com cadastro: {lastNonZeroPoint.label} ({lastNonZeroPoint.value})
          </span>
        ) : null}
      </div>

      <div className="relative mt-3">
        <div
          className="relative h-[var(--chart-height-mobile)] w-full md:h-[var(--chart-height-desktop)]"
          style={chartHeightVars}
          onMouseLeave={() => setHoveredMonth(null)}
        >
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="h-full w-full"
            role="img"
            aria-label={`Cadastros mensais de ${year}. Total do ano: ${total}. Pico em ${peak.label} com ${peak.value}.`}
          >
            <defs>
              <linearGradient id={`areaGradient-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={AREA_OPACITY} />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {Array.from({ length: GRID_LINES }, (_, idx) => {
              const y = plotTop + (idx / (GRID_LINES - 1)) * plotHeight;
              return (
                <line
                  key={idx}
                  x1={0}
                  x2={VIEWBOX_WIDTH}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth="0.32"
                />
              );
            })}

            <line
              x1={0}
              x2={VIEWBOX_WIDTH}
              y1={averageY}
              y2={averageY}
              stroke="rgba(30,41,59,0.2)"
              strokeWidth="0.28"
              strokeDasharray="1.3 1.2"
            />

            <path d={areaPath} fill={`url(#areaGradient-${gradientId})`} />

            {hasPreviousLine ? (
              <path
                d={previousLinePath}
                fill="none"
                stroke="rgba(100,116,139,0.5)"
                strokeWidth="0.95"
                strokeDasharray="1.6 1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {hoveredPoint ? (
              <line
                x1={hoveredPoint.x}
                y1={plotTop}
                x2={hoveredPoint.x}
                y2={plotBottom}
                stroke="rgba(16,185,129,0.24)"
                strokeWidth="0.3"
                strokeDasharray="1 1.2"
              />
            ) : null}

            <path d={currentLinePath} fill="none" stroke="rgba(5,150,105,0.08)" strokeWidth={STROKE_WIDTH + 0.45} />
            <path
              d={currentLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth={STROKE_WIDTH}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {currentPoints.map((point) => {
              const isHovered = hoveredMonth === point.month;
              const isSelected = selectedMonth === point.month;
              return (
                <circle
                  key={point.month}
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 1.28 : isSelected ? 1.08 : 0.62}
                  fill={isHovered ? "#047857" : "#10b981"}
                  fillOpacity={isHovered || isSelected ? 0.95 : 0}
                />
              );
            })}

            {currentPoints.map((point, index) => {
              const previousPoint = currentPoints[index - 1];
              const nextPoint = currentPoints[index + 1];
              const startX = previousPoint ? (previousPoint.x + point.x) / 2 : 0;
              const endX = nextPoint ? (nextPoint.x + point.x) / 2 : VIEWBOX_WIDTH;
              return (
                <rect
                  key={`hover-zone-${point.month}`}
                  x={startX}
                  y={plotTop}
                  width={endX - startX}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredMonth(point.month)}
                  onClick={() => onMonthSelect?.(selectedMonth === point.month ? null : point.month)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>

          {activePoint ? (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-2 text-[10.5px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm"
              style={{ left: `${activePoint.x}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-slate-700">
                {activePoint.label} · {activePoint.value}
              </p>
              {activeVariation ? (
                <p className={activeVariation.tone}>
                  Variação: <span className="font-semibold">{activeVariation.text}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-12 gap-1 text-[10px] sm:text-[10.5px]">
          {normalizedData.map((entry) => {
            const isSelected = selectedMonth === entry.month;
            return (
              <button
                key={entry.month}
                type="button"
                onClick={() => onMonthSelect?.(isSelected ? null : entry.month)}
                onMouseEnter={() => setHoveredMonth(entry.month)}
                onMouseLeave={() => setHoveredMonth(null)}
                className={`rounded-md py-1 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${isSelected
                    ? "bg-emerald-50 font-semibold text-emerald-900"
                    : "text-slate-500 hover:bg-tea-100/60 hover:text-slate-700"
                  }`}
                aria-label={`${entry.label}: ${entry.value} cadastros`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="sr-only">
        {normalizedData.map((entry) => (
          <li key={entry.month}>
            {entry.label}: {entry.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
