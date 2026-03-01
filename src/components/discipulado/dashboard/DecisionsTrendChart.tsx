"use client";

import { CSSProperties, useId, useMemo, useState } from "react";
import { DecisionsChartGranularity, DecisionsTrendPoint } from "./types";

const HEIGHT_DESKTOP = 320;
const HEIGHT_MOBILE = 220;

const VIEWBOX_WIDTH = 120;
const VIEWBOX_HEIGHT = 64;
const PLOT_TOP = 7;
const PLOT_BOTTOM = 48;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const GRID_LINES = 5;

const BAR_WIDTH = 4.4;
const BAR_RADIUS = 1.2;
const LINE_COLOR = "#059669";

const GRANULARITY_OPTIONS: Array<{ value: DecisionsChartGranularity; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calcVariation(current: number, previous: number | null) {
  if (previous === null || previous <= 0) {
    return {
      delta: null as number | null,
      percent: null as number | null,
      text: "— vs período anterior"
    };
  }

  const delta = current - previous;
  const percent = (delta / previous) * 100;
  const absText = `${delta > 0 ? "+" : ""}${delta}`;
  const pctText = `${percent > 0 ? "+" : ""}${Math.abs(percent) >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;

  return {
    delta,
    percent,
    text: `${absText} (${pctText}) vs período anterior`
  };
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

    const tension = 0.16;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
}

function buildTopRoundedBarPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  const right = x + width;

  if (height <= 0) {
    return "";
  }

  if (height <= r) {
    return `M ${x} ${bottom} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r} L ${right} ${bottom} Z`;
  }

  return `M ${x} ${bottom} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r} L ${right} ${bottom} Z`;
}

function buildTickIndexes(size: number, maxTicks = 8) {
  if (size <= 0) return [] as number[];
  if (size <= maxTicks) return Array.from({ length: size }, (_, index) => index);

  const indexes = new Set<number>([0, size - 1]);
  const step = (size - 1) / (maxTicks - 1);
  for (let tick = 1; tick < maxTicks - 1; tick += 1) {
    indexes.add(Math.round(tick * step));
  }

  return [...indexes].sort((a, b) => a - b);
}

function variationTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-500";
}

export function DecisionsTrendChart({
  data,
  granularity,
  onGranularityChange
}: {
  data: DecisionsTrendPoint[];
  granularity: DecisionsChartGranularity;
  onGranularityChange: (value: DecisionsChartGranularity) => void;
}) {
  const chartHeightVars = {
    "--decisions-chart-height-mobile": `${HEIGHT_MOBILE}px`,
    "--decisions-chart-height-desktop": `${HEIGHT_DESKTOP}px`
  } as CSSProperties;

  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasData = useMemo(() => data.some((item) => item.total > 0), [data]);

  const maxValue = useMemo(() => Math.max(...data.map((item) => item.total), 1), [data]);

  const points = useMemo(() => {
    if (!data.length) return [] as Array<DecisionsTrendPoint & { x: number; y: number; barX: number; barY: number; barHeight: number }>;

    const slot = VIEWBOX_WIDTH / data.length;

    return data.map((item, index) => {
      const x = index * slot + slot / 2;
      const y = PLOT_BOTTOM - (item.total / maxValue) * PLOT_HEIGHT;
      const barHeight = (item.total / maxValue) * PLOT_HEIGHT;
      const barY = PLOT_BOTTOM - barHeight;

      return {
        ...item,
        x,
        y,
        barX: x - BAR_WIDTH / 2,
        barY,
        barHeight
      };
    });
  }, [data, maxValue]);

  const linePath = useMemo(() => buildSmoothPath(points.map((point) => ({ x: point.x, y: point.y }))), [points]);

  const areaPath = useMemo(() => {
    if (!points.length) return "";
    const smooth = buildSmoothPath(points.map((point) => ({ x: point.x, y: point.y })));
    const start = points[0]?.x ?? 0;
    const end = points[points.length - 1]?.x ?? 0;
    return `${smooth} L ${end} ${PLOT_BOTTOM} L ${start} ${PLOT_BOTTOM} Z`;
  }, [points]);

  const peakPoint = useMemo(() => {
    if (!points.length) return null;
    return points.reduce((best, current) => (current.total > best.total ? current : best), points[0]);
  }, [points]);

  const activePoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const tooltipPoint = activePoint ?? peakPoint;
  const tooltipLeft = tooltipPoint ? clamp(tooltipPoint.x, 12, 88) : 50;

  const yTickValues = useMemo(
    () => Array.from({ length: GRID_LINES }, (_, idx) => Math.round((maxValue * (GRID_LINES - 1 - idx)) / (GRID_LINES - 1))),
    [maxValue]
  );

  const xAxisPoints = useMemo(() => {
    const indexes = buildTickIndexes(points.length, granularity === "day" ? 8 : 6);
    return indexes.map((index) => points[index]).filter(Boolean);
  }, [granularity, points]);

  const average = useMemo(() => {
    if (!points.length) return 0;
    return points.reduce((sum, point) => sum + point.total, 0) / points.length;
  }, [points]);

  const averageY = useMemo(() => PLOT_BOTTOM - (average / maxValue) * PLOT_HEIGHT, [average, maxValue]);

  if (!data.length || !hasData) {
    return (
      <section className="discipulado-panel p-4 sm:p-5" aria-label="Gráfico de Decisões">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-sky-900">Decisões</h3>
          <div className="inline-flex min-w-max rounded-lg border border-sky-200 bg-white p-1">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGranularityChange(option.value)}
                className={`rounded-md px-3 py-2.5 text-xs font-semibold transition ${
                  granularity === option.value ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
                aria-pressed={granularity === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Sem dados no período.
        </div>
      </section>
    );
  }

  const tooltipVariation = tooltipPoint ? calcVariation(tooltipPoint.total, tooltipPoint.previousTotal) : calcVariation(0, null);

  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Gráfico de Decisões">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Decisões</h3>
          <p className="text-xs text-slate-600">Série temporal de decisões com variação em relação ao período anterior.</p>
        </div>
        <div className="-mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="inline-flex min-w-max rounded-lg border border-sky-200 bg-white p-1">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGranularityChange(option.value)}
                className={`rounded-md px-3 py-2.5 text-xs font-semibold transition ${
                  granularity === option.value ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
                aria-pressed={granularity === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4" onMouseLeave={() => setHoveredIndex(null)}>
        <div
          className="relative h-[var(--decisions-chart-height-mobile)] w-full md:h-[var(--decisions-chart-height-desktop)]"
          style={chartHeightVars}
        >
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full overflow-visible" role="img" aria-label="Gráfico de decisões">
            <defs>
              <linearGradient id={`decisions-area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.22" />
                <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {yTickValues.map((value, idx) => {
              const y = PLOT_TOP + (idx / (GRID_LINES - 1)) * PLOT_HEIGHT;
              return (
                <g key={`grid-${value}-${idx}`}>
                  <line
                    x1={0}
                    x2={VIEWBOX_WIDTH}
                    y1={y}
                    y2={y}
                    stroke="#E2E8F0"
                    opacity="0.6"
                    strokeDasharray="3 3"
                    strokeWidth="0.28"
                  />
                  <text x={0.6} y={y - 0.5} fill="#94a3b8" fontSize="1.8" textAnchor="start">
                    {value}
                  </text>
                </g>
              );
            })}

            {points.map((point, index) => {
              const isActive = hoveredIndex === index;
              const barPath = buildTopRoundedBarPath(point.barX, point.barY, BAR_WIDTH, point.barHeight, BAR_RADIUS);
              return (
                <path
                  key={point.key}
                  d={barPath}
                  fill={LINE_COLOR}
                  fillOpacity={isActive ? 0.9 : 0.26}
                />
              );
            })}

            <path d={areaPath} fill={`url(#decisions-area-${gradientId})`} />

            <line
              x1={0}
              x2={VIEWBOX_WIDTH}
              y1={averageY}
              y2={averageY}
              stroke="#64748b"
              strokeOpacity="0.6"
              strokeDasharray="2.4 2.4"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={VIEWBOX_WIDTH - 0.8}
              y={Math.max(PLOT_TOP + 0.8, averageY - 0.8)}
              textAnchor="end"
              fill="#64748b"
              fontSize="1.95"
              fontWeight="600"
            >
              média {average.toFixed(1).replace(".", ",")}
            </text>

            <path
              d={linePath}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {peakPoint ? (
              <>
                <circle cx={peakPoint.x} cy={peakPoint.y} r={1.8} fill={LINE_COLOR} fillOpacity="0.18" />
                <circle cx={peakPoint.x} cy={peakPoint.y} r={1} fill="#047857" />
              </>
            ) : null}

            {activePoint ? (
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={1.45}
                fill="#ffffff"
                stroke={LINE_COLOR}
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {points.map((point, index) => {
              const halfSlot = VIEWBOX_WIDTH / Math.max(points.length, 1) / 2;
              return (
                <rect
                  key={`hit-${point.key}`}
                  x={point.x - halfSlot}
                  y={PLOT_TOP}
                  width={halfSlot * 2}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onClick={() => setHoveredIndex(index)}
                />
              );
            })}
          </svg>
        </div>

        {tooltipPoint ? (
          <div
            className="pointer-events-none absolute -top-2 z-10 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.12)] backdrop-blur"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="text-xs font-semibold text-slate-900">{tooltipPoint.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{tooltipPoint.total} decisões</p>
            <p className={`mt-1 text-xs font-medium ${variationTone(tooltipVariation.delta)}`}>{tooltipVariation.text}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Período</span>
        <span>Total: {points.reduce((sum, point) => sum + point.total, 0)}</span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 overflow-x-auto text-[11px] text-slate-500">
        {xAxisPoints.map((point) => (
          <span key={`label-${point.key}`} className="min-w-[3rem] text-center">
            {point.label}
          </span>
        ))}
      </div>
    </section>
  );
}
