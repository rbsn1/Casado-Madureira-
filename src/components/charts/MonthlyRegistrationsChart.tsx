"use client";

import { CSSProperties, useId, useMemo, useState } from "react";

type ChartEntry = {
  month: number;
  label: string;
  value: number;
};

type NormalizedMonthEntry = ChartEntry & {
  isFuture: boolean;
};

type ChartPoint = NormalizedMonthEntry & {
  x: number;
  y: number | null;
  prevValue: number | null;
};

type VisibleChartPoint = ChartPoint & { y: number };

const defaultMonthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Chart tuning constants
export const HEIGHT_DESKTOP = 220;
export const HEIGHT_MOBILE = 180;
export const GRID_LINES = 5;
export const AREA_OPACITY = 0.23;
export const STROKE_WIDTH = 4;

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;
const plotTop = 5.4;
const plotBottom = 32.8;
const plotHeight = plotBottom - plotTop;

function sanitizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function formatVariation(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) {
    return { text: "—", tone: "text-slate-500", arrow: "" };
  }

  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const roundedPct = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  const signedDiff = `${diff > 0 ? "+" : ""}${diff}`;
  const signedPct = `${pct > 0 ? "+" : ""}${roundedPct}%`;

  if (pct > 0) return { text: `${signedDiff} (${signedPct})`, tone: "text-emerald-700", arrow: "↑" };
  if (pct < 0) return { text: `${signedDiff} (${signedPct})`, tone: "text-rose-700", arrow: "↓" };
  return { text: `${signedDiff} (${signedPct})`, tone: "text-slate-500", arrow: "→" };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const tension = 0.18;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;

    const control1x = current.x + ((next.x - previous.x) / 6) * tension;
    const control1y = current.y + ((next.y - previous.y) / 6) * tension;
    const control2x = next.x - ((afterNext.x - current.x) / 6) * tension;
    const control2y = next.y - ((afterNext.y - current.y) / 6) * tension;

    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`;
  }

  return path;
}

function formatMonthYear(monthLabel: string, year: number) {
  const label = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).toLowerCase();
  return `${label}/${year}`;
}

function isFutureMonth(targetYear: number, targetMonth: number, now: Date) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (targetYear > currentYear) return true;
  if (targetYear < currentYear) return false;
  return targetMonth > currentMonth;
}

function variationForHover(current: number | null, previous: number | null) {
  if (previous === null || previous <= 0) {
    return { text: "—", tone: "text-slate-500", arrow: "" };
  }

  return formatVariation(current, previous);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isVisiblePoint(point: ChartPoint): point is VisibleChartPoint {
  return point.y !== null;
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
  const now = useMemo(() => new Date(), []);

  const normalizedData = useMemo(() => {
    const byMonth = new Map<number, ChartEntry>();
    data.forEach((item) => byMonth.set(item.month, item));

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const source = byMonth.get(month);
      return {
        month,
        label: source?.label ?? defaultMonthLabels[index],
        value: sanitizeNumber(source?.value),
        isFuture: isFutureMonth(year, month, now)
      };
    });
  }, [data, now, year]);

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
    return normalizedData.map((entry, index): ChartPoint => {
      const x = (index / (normalizedData.length - 1)) * 100;
      const y = entry.isFuture ? null : plotBottom - (entry.value / maxValue) * plotHeight;
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

  const plotPoints = useMemo(
    () => currentPoints.filter((point) => point.y !== null).map((point) => ({ x: point.x, y: point.y as number })),
    [currentPoints]
  );

  const currentLinePath = useMemo(() => {
    if (!plotPoints.length) return "";
    return buildSmoothPath(plotPoints);
  }, [plotPoints]);

  const previousLinePath = useMemo(() => {
    if (!previousPoints.length) return "";
    return previousPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }, [previousPoints]);

  const areaPath = useMemo(() => {
    if (!plotPoints.length) return "";
    const start = `M ${plotPoints[0].x} ${plotBottom}`;
    const lines = plotPoints.map((point) => `L ${point.x} ${point.y}`).join(" ");
    const end = `L ${plotPoints[plotPoints.length - 1].x} ${plotBottom} Z`;
    return `${start} ${lines} ${end}`;
  }, [plotPoints]);

  const hoveredPoint = useMemo(
    () => (hoveredMonth ? currentPoints.find((point) => point.month === hoveredMonth) ?? null : null),
    [currentPoints, hoveredMonth]
  );

  const selectedPoint = useMemo(
    () => (selectedMonth ? currentPoints.find((point) => point.month === selectedMonth) ?? null : null),
    [selectedMonth, currentPoints]
  );

  const activePoint = hoveredPoint ?? selectedPoint;

  const activeVariation = useMemo(() => {
    if (!activePoint) return null;
    return variationForHover(activePoint.isFuture ? null : activePoint.value, activePoint.prevValue);
  }, [activePoint]);

  const hasPreviousLine = useMemo(
    () => Boolean(normalizedPreviousData?.some((item) => item.value > 0)),
    [normalizedPreviousData]
  );

  const averageY = useMemo(() => plotBottom - (average / maxValue) * plotHeight, [average, maxValue]);

  const peakPoint = useMemo(() => {
    const visiblePoints = currentPoints.filter(isVisiblePoint);
    if (!visiblePoints.length) return null;
    return visiblePoints.reduce((best, item) => (item.value > best.value ? item : best), visiblePoints[0]);
  }, [currentPoints]);

  const lastNonZeroPoint = useMemo(() => {
    const found =
      [...currentPoints].reverse().find((point): point is VisibleChartPoint => point.value > 0 && point.y !== null) ??
      null;
    if (!found || !peakPoint) return found;
    const conflict = Math.abs(found.x - peakPoint.x) < 10 && Math.abs(found.y - peakPoint.y) < 6;
    return conflict ? null : found;
  }, [currentPoints, peakPoint]);

  const monthsWithDataCount = useMemo(
    () => normalizedData.filter((item) => !item.isFuture && item.value > 0).length,
    [normalizedData]
  );
  const shouldRenderAverageLine = monthsWithDataCount >= 3;

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
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
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
                  stroke="rgba(148,163,184,0.34)"
                  strokeWidth="0.34"
                />
              );
            })}

            {shouldRenderAverageLine ? (
              <>
                <line
                  x1={0}
                  x2={VIEWBOX_WIDTH}
                  y1={averageY}
                  y2={averageY}
                  stroke="rgba(30,41,59,0.35)"
                  strokeWidth="0.34"
                  strokeDasharray="1.8 1.4"
                />
                <text
                  x={99}
                  y={clamp(averageY - 0.9, plotTop + 1, plotBottom - 0.8)}
                  textAnchor="end"
                  fontSize="1.85"
                  fill="rgba(71,85,105,0.95)"
                >
                  média {average.toFixed(1)}
                </text>
              </>
            ) : null}

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
                stroke="rgba(15,23,42,0.18)"
                strokeWidth="0.22"
                strokeDasharray="1.1 1.5"
              />
            ) : null}

            <path d={currentLinePath} fill="none" stroke="rgba(5,150,105,0.12)" strokeWidth={STROKE_WIDTH + 1} />
            <path
              d={currentLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth={STROKE_WIDTH}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {peakPoint && peakPoint.y !== null ? (
              <text
                x={clamp(peakPoint.x, 7, 93)}
                y={clamp(peakPoint.y - 1.6, plotTop + 1.5, plotBottom - 1.2)}
                textAnchor="middle"
                fontSize="1.85"
                fill="rgba(6,78,59,0.95)"
                fontWeight="700"
              >
                Pico
              </text>
            ) : null}

            {lastNonZeroPoint && lastNonZeroPoint.y !== null ? (
              <text
                x={clamp(lastNonZeroPoint.x, 7, 93)}
                y={clamp(lastNonZeroPoint.y - 1.2, plotTop + 1.5, plotBottom - 1.2)}
                textAnchor="middle"
                fontSize="1.75"
                fill="rgba(100,116,139,0.92)"
              >
                {`${lastNonZeroPoint.label} · ${lastNonZeroPoint.value}`}
              </text>
            ) : null}

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

          <div className="pointer-events-none absolute inset-0">
            {peakPoint && peakPoint.y !== null ? (
              <span
                className="absolute rounded-full border-2 border-white bg-emerald-600 shadow-[0_0_0_2px_rgba(16,185,129,0.22)]"
                style={{
                  left: `${peakPoint.x}%`,
                  top: `${(peakPoint.y / VIEWBOX_HEIGHT) * 100}%`,
                  width: "11px",
                  height: "11px",
                  transform: "translate(-50%, -50%)"
                }}
              />
            ) : null}
            {lastNonZeroPoint && lastNonZeroPoint.y !== null ? (
              <span
                className="absolute rounded-full border-2 border-white bg-slate-500 shadow-[0_0_0_2px_rgba(100,116,139,0.18)]"
                style={{
                  left: `${lastNonZeroPoint.x}%`,
                  top: `${(lastNonZeroPoint.y / VIEWBOX_HEIGHT) * 100}%`,
                  width: "10px",
                  height: "10px",
                  transform: "translate(-50%, -50%)"
                }}
              />
            ) : null}
            {hoveredPoint && hoveredPoint.y !== null ? (
              <span
                className="absolute rounded-full border-2 border-white bg-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.24)]"
                style={{
                  left: `${hoveredPoint.x}%`,
                  top: `${(hoveredPoint.y / VIEWBOX_HEIGHT) * 100}%`,
                  width: "13px",
                  height: "13px",
                  transform: "translate(-50%, -50%)"
                }}
              />
            ) : null}
          </div>

          {activePoint ? (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-2 text-[10.5px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm"
              style={{ left: `${clamp(activePoint.x, 12, 88)}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-slate-700">{formatMonthYear(activePoint.label, year)}</p>
              <p className="text-xl font-bold leading-none text-emerald-900">{activePoint.isFuture ? "—" : activePoint.value}</p>
              <p className="text-[11px] text-slate-500">Total no mês</p>
              {activeVariation ? (
                <p className={activeVariation.tone}>
                  Variação: <span className="font-semibold">{activeVariation.arrow} {activeVariation.text}</span>
                </p>
              ) : null}
              {peakPoint && activePoint.month === peakPoint.month ? (
                <p className="font-semibold text-emerald-800">Pico do período</p>
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
                {entry.isFuture ? "—" : entry.label}
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
