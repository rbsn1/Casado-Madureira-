"use client";

import { CSSProperties, useId, useMemo, useState } from "react";
import { DecisionsChartGranularity, DecisionsTrendPoint } from "./types";

const HEIGHT_DESKTOP = 280;
const HEIGHT_MOBILE = 220;
const GRID_LINES = 5;

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 44;
const PLOT_TOP = 4.8;
const PLOT_BOTTOM = 33.8;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const CHART_LINE_COLOR = "#0369A1";
const CHART_PEAK_COLOR = "#7C3AED";
const CHART_GRID_COLOR = "#E2E8F0";

const GRANULARITY_OPTIONS: Array<{ value: DecisionsChartGranularity; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function variationText(point: DecisionsTrendPoint) {
  if (point.variationAbs === null || point.variationPct === null) return "—";
  const abs = `${point.variationAbs > 0 ? "+" : ""}${point.variationAbs}`;
  const pct = Math.abs(point.variationPct) >= 10 ? point.variationPct.toFixed(0) : point.variationPct.toFixed(1);
  return `${abs} (${point.variationPct > 0 ? "+" : ""}${pct}%)`;
}

function variationTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-500";
}

function variationArrow(value: number | null) {
  if (value === null) return "";
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "→";
}

function buildTickIndexes(size: number, maxTicks = 6) {
  if (size <= 0) return [] as number[];
  if (size <= maxTicks) return Array.from({ length: size }, (_, index) => index);

  const indexes = new Set<number>([0, size - 1]);
  const step = (size - 1) / (maxTicks - 1);
  for (let tick = 1; tick < maxTicks - 1; tick += 1) {
    indexes.add(Math.round(tick * step));
  }

  return [...indexes].sort((a, b) => a - b);
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

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const hasData = useMemo(() => data.some((item) => item.total > 0), [data]);

  const maxValue = useMemo(() => Math.max(...data.map((item) => item.total), 1), [data]);

  const points = useMemo(() => {
    if (!data.length) return [] as Array<DecisionsTrendPoint & { x: number; y: number }>;
    const divisor = Math.max(data.length - 1, 1);
    return data.map((item, index) => {
      const x = (index / divisor) * 100;
      const y = PLOT_BOTTOM - (item.total / maxValue) * PLOT_HEIGHT;
      return { ...item, x, y };
    });
  }, [data, maxValue]);

  const linePath = useMemo(() => buildPath(points.map((point) => ({ x: point.x, y: point.y }))), [points]);

  const areaPath = useMemo(() => {
    if (!points.length) return "";
    const start = `M ${points[0].x} ${PLOT_BOTTOM}`;
    const lines = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
    const end = `L ${points[points.length - 1].x} ${PLOT_BOTTOM} Z`;
    return `${start} ${lines} ${end}`;
  }, [points]);

  const peakPoint = useMemo(() => {
    if (!points.length) return null;
    return points.reduce((best, current) => (current.total > best.total ? current : best), points[0]);
  }, [points]);

  const activePoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const tooltipPoint = activePoint ?? peakPoint;
  const tooltipLeft = tooltipPoint ? clamp(tooltipPoint.x, 12, 88) : 50;
  const peakPointKey = peakPoint?.key ?? null;

  const xAxisPoints = useMemo(() => {
    const indexes = buildTickIndexes(points.length, 6);
    return indexes.map((index) => points[index]).filter(Boolean);
  }, [points]);

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

      <div className="relative mt-3" onMouseLeave={() => setHoveredIndex(null)}>
        <div
          className="relative h-[var(--decisions-chart-height-mobile)] w-full md:h-[var(--decisions-chart-height-desktop)]"
          style={chartHeightVars}
        >
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full" role="img" aria-label="Gráfico de decisões">
            <defs>
              <linearGradient id={`decisions-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={CHART_LINE_COLOR} stopOpacity="0.25" />
                <stop offset="100%" stopColor={CHART_LINE_COLOR} stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {Array.from({ length: GRID_LINES }).map((_, idx) => {
              const y = PLOT_TOP + (idx / (GRID_LINES - 1)) * PLOT_HEIGHT;
              return (
                <line
                  key={idx}
                  x1={0}
                  y1={y}
                  x2={VIEWBOX_WIDTH}
                  y2={y}
                  stroke={CHART_GRID_COLOR}
                  strokeWidth="0.35"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
              );
            })}

            <path d={areaPath} fill={`url(#decisions-${gradientId})`} />

            {hoveredIndex !== null && activePoint ? (
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="rgba(14,116,144,0.3)"
                strokeWidth="0.28"
                strokeDasharray="1 1.2"
              />
            ) : null}

            <path
              d={linePath}
              fill="none"
              stroke={CHART_LINE_COLOR}
              strokeOpacity="0.16"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={linePath}
              fill="none"
              stroke={CHART_LINE_COLOR}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {Array.from({ length: GRID_LINES }).map((_, idx) => {
              const y = PLOT_TOP + (idx / (GRID_LINES - 1)) * PLOT_HEIGHT;
              const value = Math.round(((GRID_LINES - 1 - idx) / (GRID_LINES - 1)) * maxValue);
              return (
                <text
                  key={`y-label-${idx}`}
                  x={99.2}
                  y={y - 0.35}
                  textAnchor="end"
                  fontSize="1.6"
                  fill="rgba(71,85,105,0.85)"
                >
                  {value}
                </text>
              );
            })}

            {xAxisPoints.map((point, index) => {
              const lastIndex = xAxisPoints.length - 1;
              const textAnchor = index === 0 ? "start" : index === lastIndex ? "end" : "middle";
              return (
                <text
                  key={`x-label-${point.key}`}
                  x={point.x}
                  y={41.5}
                  textAnchor={textAnchor}
                  fontSize="1.7"
                  fill="rgba(71,85,105,0.9)"
                  fontWeight="500"
                >
                  {point.label}
                </text>
              );
            })}

            {peakPoint ? (
              <text
                x={clamp(peakPoint.x, 8, 92)}
                y={clamp(peakPoint.y - 1.6, PLOT_TOP + 1.4, PLOT_BOTTOM - 1)}
                textAnchor="middle"
                fontSize="1.8"
                fill={CHART_PEAK_COLOR}
                fontWeight="700"
              >
                Pico
              </text>
            ) : null}

            {points.map((point, index) => {
              const previous = points[index - 1];
              const next = points[index + 1];
              const startX = previous ? (previous.x + point.x) / 2 : 0;
              const endX = next ? (next.x + point.x) / 2 : VIEWBOX_WIDTH;
              return (
                <rect
                  key={`zone-${point.key}`}
                  x={startX}
                  y={PLOT_TOP}
                  width={endX - startX}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {points.map((point, index) => {
              const isActive = hoveredIndex === index;
              const isPeak = point.key === peakPointKey;
              const size = isActive ? 14 : 10;
              const color = isPeak ? CHART_PEAK_COLOR : CHART_LINE_COLOR;
              const top = `${(point.y / VIEWBOX_HEIGHT) * 100}%`;

              return (
                <span
                  key={`dot-${point.key}`}
                  className="absolute rounded-full border-2 border-white"
                  style={{
                    left: `${point.x}%`,
                    top,
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: "translate(-50%, -50%)",
                    backgroundColor: color,
                    boxShadow: isPeak
                      ? "0 0 0 3px rgba(124,58,237,0.22)"
                      : "0 0 0 2px rgba(3,105,161,0.12)"
                  }}
                />
              );
            })}
          </div>

          {tooltipPoint ? (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-2 text-[10.5px] shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
              style={{ left: `${tooltipLeft}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-slate-700">{tooltipPoint.label}</p>
              <p className="mt-1 text-2xl font-bold leading-none text-sky-800">{tooltipPoint.total}</p>
              <p className="text-[11px] text-slate-600">decisões</p>
              <p className={`${variationTone(tooltipPoint.variationPct)}`}>
                Variação:{" "}
                <span className="font-semibold">
                  {variationArrow(tooltipPoint.variationAbs)} {variationText(tooltipPoint)}
                </span>
              </p>
              {peakPoint && tooltipPoint.key === peakPoint.key ? (
                <p className="font-semibold text-indigo-700">Pico do período</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
