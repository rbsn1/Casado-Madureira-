"use client";

import { CSSProperties, useId, useMemo, useState } from "react";

type ChartEntry = {
  month: number;
  label: string;
  value: number;
};

type NormalizedChartEntry = Omit<ChartEntry, "value"> & {
  value: number | null;
  isFuture: boolean;
};

type PreviousChartEntry = Omit<ChartEntry, "value"> & {
  value: number;
  isFuture: false;
};

type CurrentPoint = NormalizedChartEntry & {
  x: number;
  y: number | null;
  prevValue: number | null;
};

const defaultMonthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Chart tuning constants
export const HEIGHT_DESKTOP = 280;
export const HEIGHT_MOBILE = 220;
export const GRID_LINES = 4;
export const AREA_OPACITY = 0.22;
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

function shouldHideMonthValue(targetYear: number, month: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return targetYear > currentYear || (targetYear === currentYear && month > currentMonth);
}

function formatVariation(current: number, previous: number | null) {
  if (previous === null || previous <= 0) {
    return {
      arrow: "—",
      absolute: "—",
      percentage: "—",
      tone: "text-slate-500"
    };
  }

  const delta = current - previous;
  const pct = ((current - previous) / previous) * 100;
  const roundedPct = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  const absolute = `${delta > 0 ? "+" : ""}${delta}`;
  const percentage = `${pct > 0 ? "+" : ""}${roundedPct}%`;
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  if (delta > 0) return { arrow, absolute, percentage, tone: "text-emerald-700" };
  if (delta < 0) return { arrow, absolute, percentage, tone: "text-rose-700" };
  return { arrow, absolute, percentage, tone: "text-slate-500" };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
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
      const isFuture = shouldHideMonthValue(year, month);
      return {
        month,
        label: source?.label ?? defaultMonthLabels[index],
        value: isFuture ? null : sanitizeNumber(source?.value),
        isFuture
      };
    });
  }, [data, year]) as NormalizedChartEntry[];

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
        value: sanitizeNumber(source?.value),
        isFuture: false
      };
    });
  }, [previousYearData]) as PreviousChartEntry[] | null;

  const total = useMemo(
    () => normalizedData.reduce((acc, item) => acc + (item.value ?? 0), 0),
    [normalizedData]
  );
  const peak = useMemo(
    () =>
      normalizedData.reduce(
        (best, item) => ((item.value ?? 0) > (best.value ?? 0) ? item : best),
        normalizedData[0]
      ),
    [normalizedData]
  );
  const average = useMemo(() => total / normalizedData.length, [total, normalizedData.length]);

  const maxValue = useMemo(() => {
    const previousMax = normalizedPreviousData
      ? Math.max(...normalizedPreviousData.map((item) => item.value ?? 0), 0)
      : 0;
    return Math.max(Math.max(...normalizedData.map((item) => item.value ?? 0), 0), previousMax, 1);
  }, [normalizedData, normalizedPreviousData]);

  const currentPoints = useMemo(() => {
    return normalizedData.map((entry, index): CurrentPoint => {
      const x = (index / (normalizedData.length - 1)) * 100;
      const y = entry.value === null ? null : plotBottom - ((entry.value ?? 0) / maxValue) * plotHeight;
      let prevValue: number | null = null;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (normalizedData[i].value !== null) {
          prevValue = normalizedData[i].value;
          break;
        }
      }
      return { ...entry, x, y, prevValue };
    });
  }, [normalizedData, maxValue]);

  const previousPoints = useMemo(() => {
    if (!normalizedPreviousData) return [];
    return normalizedPreviousData.map((entry, index) => {
      const x = (index / (normalizedPreviousData.length - 1)) * 100;
      const y = plotBottom - ((entry.value ?? 0) / maxValue) * plotHeight;
      return { ...entry, x, y };
    });
  }, [normalizedPreviousData, maxValue]);

  const currentLineSegments = useMemo(() => {
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let buffer: Array<{ x: number; y: number }> = [];
    currentPoints.forEach((point) => {
      if (point.y === null) {
        if (buffer.length) segments.push(buffer);
        buffer = [];
        return;
      }
      buffer.push({ x: point.x, y: point.y });
    });
    if (buffer.length) segments.push(buffer);
    return segments;
  }, [currentPoints]);

  const currentLinePath = useMemo(
    () => currentLineSegments.map((segment) => buildSmoothPath(segment)).join(" "),
    [currentLineSegments]
  );

  const previousLinePath = useMemo(() => {
    if (!previousPoints.length) return "";
    return buildSmoothPath(previousPoints.map((point) => ({ x: point.x, y: point.y })));
  }, [previousPoints]);

  const areaPaths = useMemo(
    () =>
      currentLineSegments
        .filter((segment) => segment.length)
        .map((segment) => {
          const smooth = buildSmoothPath(segment);
          const startX = segment[0].x;
          const endX = segment[segment.length - 1].x;
          return `${smooth} L ${endX} ${plotBottom} L ${startX} ${plotBottom} Z`;
        }),
    [currentLineSegments]
  );

  const hoveredPoint = useMemo(
    () =>
      hoveredMonth
        ? currentPoints.find(
            (point): point is CurrentPoint & { value: number } => point.month === hoveredMonth && point.value !== null
          ) ?? null
        : null,
    [hoveredMonth, currentPoints]
  );

  const selectedPoint = useMemo(
    () =>
      selectedMonth
        ? currentPoints.find(
            (point): point is CurrentPoint & { value: number } => point.month === selectedMonth && point.value !== null
          ) ?? null
        : null,
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
    const found = [...currentPoints].reverse().find((point) => point.value !== null && point.value > 0 && point.y !== null) ?? null;
    if (!found || !peakPoint || peakPoint.y === null || found.y === null) return found;
    const conflict = Math.abs(found.x - peakPoint.x) < 10 && Math.abs(found.y - peakPoint.y) < 6;
    return conflict ? null : found;
  }, [currentPoints, peakPoint]);

  const showAverageLine = useMemo(
    () => normalizedData.some((item) => item.value !== null),
    [normalizedData]
  );

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
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
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
                  stroke="#E2E8F0"
                  strokeOpacity="0.6"
                  strokeDasharray="3 3"
                  strokeWidth="0.28"
                />
              );
            })}

            {showAverageLine ? (
              <>
                <line
                  x1={0}
                  x2={VIEWBOX_WIDTH}
                  y1={averageY}
                  y2={averageY}
                  stroke="rgba(71,85,105,0.35)"
                  strokeWidth="0.18"
                  strokeDasharray="1.2 1.2"
                />
                <text
                  x={VIEWBOX_WIDTH - 0.8}
                  y={Math.max(plotTop + 0.8, averageY - 0.6)}
                  textAnchor="end"
                  fill="rgba(71,85,105,0.7)"
                  fontSize="1.8"
                  fontWeight="500"
                >
                  Média
                </text>
              </>
            ) : null}

            {areaPaths.map((pathData, index) => (
              <path key={`area-${index}`} d={pathData} fill={`url(#areaGradient-${gradientId})`} />
            ))}

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
                stroke="rgba(15,23,42,0.2)"
                strokeWidth="0.2"
                strokeDasharray="0.9 1.1"
              />
            ) : null}

            <path
              d={currentLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth={STROKE_WIDTH}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {peakPoint && peakPoint.y !== null ? (
              <circle cx={peakPoint.x} cy={peakPoint.y} r={0.86} fill="#047857" />
            ) : null}

            {lastNonZeroPoint && lastNonZeroPoint.y !== null ? (
              <circle cx={lastNonZeroPoint.x} cy={lastNonZeroPoint.y} r={0.72} fill="#0f766e" fillOpacity={0.92} />
            ) : null}

            {activePoint && activePoint.y !== null ? (
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={0.96}
                fill="#ffffff"
                stroke="#059669"
                strokeWidth="0.24"
              />
            ) : null}

            {currentPoints.map((point, index) => {
              const previousPoint = currentPoints[index - 1];
              const nextPoint = currentPoints[index + 1];
              const startX = previousPoint ? (previousPoint.x + point.x) / 2 : 0;
              const endX = nextPoint ? (nextPoint.x + point.x) / 2 : VIEWBOX_WIDTH;
              const isFuture = point.value === null;
              return (
                <rect
                  key={`hover-zone-${point.month}`}
                  x={startX}
                  y={plotTop}
                  width={endX - startX}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => {
                    if (!isFuture) setHoveredMonth(point.month);
                  }}
                  onClick={() => {
                    if (!isFuture) onMonthSelect?.(selectedMonth === point.month ? null : point.month);
                  }}
                  style={{ cursor: isFuture ? "default" : "pointer" }}
                />
              );
            })}
          </svg>

          {activePoint ? (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-2 text-[10.5px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm"
              style={{ left: `${activePoint.x}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-slate-800">{activePoint.label}/{year}</p>
              <p className="text-sm font-semibold text-emerald-900">{activePoint.value}</p>
              {activeVariation ? (
                <p className={activeVariation.tone}>
                  Variação: <span className="font-semibold">{activeVariation.arrow} {activeVariation.absolute} ({activeVariation.percentage})</span>
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
                aria-label={`${entry.isFuture ? "Mês futuro" : `${entry.label}: ${entry.value} cadastros`}`}
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
