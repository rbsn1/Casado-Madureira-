"use client";

import { CSSProperties, useId, useMemo, useState } from "react";
import { DecisionsChartGranularity, DecisionsTrendPoint } from "./types";

const HEIGHT_DESKTOP = 260;
const HEIGHT_MOBILE = 220;
const GRID_LINES = 5;

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 44;
const PLOT_TOP = 4.8;
const PLOT_BOTTOM = 33.8;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

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
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {Array.from({ length: GRID_LINES }).map((_, idx) => {
              const y = PLOT_TOP + (idx / (GRID_LINES - 1)) * PLOT_HEIGHT;
              return (
                <line key={idx} x1={0} y1={y} x2={VIEWBOX_WIDTH} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="0.3" />
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

            <path d={linePath} fill="none" stroke="rgba(2,132,199,0.2)" strokeWidth="1.35" />
            <path d={linePath} fill="none" stroke="#0284c7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

            {peakPoint ? (
              <text
                x={clamp(peakPoint.x, 8, 92)}
                y={clamp(peakPoint.y - 1.4, PLOT_TOP + 1.4, PLOT_BOTTOM - 1)}
                textAnchor="middle"
                fontSize="1.8"
                fill="rgba(3,105,161,0.9)"
                fontWeight="600"
              >
                {`Pico · ${peakPoint.total}`}
              </text>
            ) : null}

            {points.map((point, index) => {
              const active = hoveredIndex === index;
              return (
                <circle key={point.key} cx={point.x} cy={point.y} r={active ? 1.1 : 0.65} fill="#0284c7" fillOpacity={active ? 0.95 : 0} />
              );
            })}

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

          {activePoint ? (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-2 text-[10.5px] shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
              style={{ left: `${activePoint.x}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-slate-700">{activePoint.label}</p>
              <p className="text-sky-700">
                Total: <span className="font-semibold">{activePoint.total}</span>
              </p>
              <p className={`${variationTone(activePoint.variationPct)}`}>
                Variação: <span className="font-semibold">{variationText(activePoint)}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
