"use client";

import { CSSProperties, useId, useMemo, useState } from "react";
import { EntryVsProgressPoint } from "./types";

const HEIGHT_DESKTOP = 260;
const HEIGHT_MOBILE = 220;
const GRID_LINES = 5;

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 44;
const PLOT_TOP = 4.8;
const PLOT_BOTTOM = 33.8;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function EntryVsProgressChart({ data }: { data: EntryVsProgressPoint[] }) {
  const chartHeightVars = {
    "--entry-progress-height-mobile": `${HEIGHT_MOBILE}px`,
    "--entry-progress-height-desktop": `${HEIGHT_DESKTOP}px`
  } as CSSProperties;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const hasData = useMemo(
    () => data.some((item) => item.novos > 0 || item.avancaram > 0),
    [data]
  );

  const maxValue = useMemo(
    () => Math.max(...data.map((item) => Math.max(item.novos, item.avancaram)), 1),
    [data]
  );

  const points = useMemo(() => {
    if (!data.length) return [] as Array<EntryVsProgressPoint & { x: number; novosY: number; avancaramY: number }>;
    const divisor = Math.max(data.length - 1, 1);
    return data.map((item, index) => {
      const x = (index / divisor) * 100;
      const novosY = PLOT_BOTTOM - (item.novos / maxValue) * PLOT_HEIGHT;
      const avancaramY = PLOT_BOTTOM - (item.avancaram / maxValue) * PLOT_HEIGHT;
      return { ...item, x, novosY, avancaramY };
    });
  }, [data, maxValue]);

  const novosPath = useMemo(
    () => buildPath(points.map((point) => ({ x: point.x, y: point.novosY }))),
    [points]
  );

  const avancaramPath = useMemo(
    () => buildPath(points.map((point) => ({ x: point.x, y: point.avancaramY }))),
    [points]
  );

  const areaPath = useMemo(() => {
    if (!points.length) return "";
    const start = `M ${points[0].x} ${PLOT_BOTTOM}`;
    const lines = points.map((point) => `L ${point.x} ${point.novosY}`).join(" ");
    const end = `L ${points[points.length - 1].x} ${PLOT_BOTTOM} Z`;
    return `${start} ${lines} ${end}`;
  }, [points]);

  const peakPoint = useMemo(() => {
    if (!points.length) return null;
    return points.reduce((best, current) => (current.novos > best.novos ? current : best), points[0]);
  }, [points]);

  const activePoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;

  const lineGapLabel = useMemo(() => {
    if (!activePoint) return "—";
    const diff = activePoint.novos - activePoint.avancaram;
    return `${diff > 0 ? "+" : ""}${diff}`;
  }, [activePoint]);

  if (!data.length || !hasData) {
    return (
      <section className="discipulado-panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-sky-900">Entrada vs Progresso</h3>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">Últimas semanas</span>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Sem dados no período.
        </div>
      </section>
    );
  }

  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Gráfico de entrada vs progresso">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Entrada vs Progresso</h3>
          <p className="text-xs text-slate-600">Novos convertidos vs avanço de etapa por semana.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Novos
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-sky-700" /> Avançaram
          </span>
        </div>
      </div>

      <div className="relative mt-3" onMouseLeave={() => setHoveredIndex(null)}>
        <div className="relative h-[var(--entry-progress-height-mobile)] w-full md:h-[var(--entry-progress-height-desktop)]" style={chartHeightVars}>
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="h-full w-full"
            role="img"
            aria-label="Tendência semanal de entrada e progresso no discipulado"
          >
            <defs>
              <linearGradient id={`entryVsProgress-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
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
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth="0.3"
                />
              );
            })}

            <path d={areaPath} fill={`url(#entryVsProgress-${gradientId})`} />

            {hoveredIndex !== null && activePoint ? (
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="rgba(14,116,144,0.28)"
                strokeWidth="0.28"
                strokeDasharray="1 1.2"
              />
            ) : null}

            <path d={novosPath} fill="none" stroke="rgba(5,150,105,0.12)" strokeWidth="1.35" />
            <path d={novosPath} fill="none" stroke="#10b981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

            <path d={avancaramPath} fill="none" stroke="rgba(3,105,161,0.14)" strokeWidth="1.3" />
            <path d={avancaramPath} fill="none" stroke="#0369a1" strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" />

            {peakPoint ? (
              <text
                x={clamp(peakPoint.x, 8, 92)}
                y={clamp(peakPoint.novosY - 1.4, PLOT_TOP + 1.4, PLOT_BOTTOM - 1)}
                textAnchor="middle"
                fontSize="1.8"
                fill="rgba(6,78,59,0.9)"
                fontWeight="600"
              >
                {`Pico · ${peakPoint.novos}`}
              </text>
            ) : null}

            {points.map((point, index) => {
              const active = hoveredIndex === index;
              return (
                <g key={point.key}>
                  <circle cx={point.x} cy={point.novosY} r={active ? 1.1 : 0.65} fill="#10b981" fillOpacity={active ? 0.95 : 0} />
                  <circle cx={point.x} cy={point.avancaramY} r={active ? 1.1 : 0.65} fill="#0369a1" fillOpacity={active ? 0.95 : 0} />
                </g>
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
              <p className="text-emerald-700">Novos: <span className="font-semibold">{activePoint.novos}</span></p>
              <p className="text-sky-700">Avançaram: <span className="font-semibold">{activePoint.avancaram}</span></p>
              <p className="text-slate-600">Diferença: <span className="font-semibold">{lineGapLabel}</span></p>
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] text-slate-500 sm:grid-cols-12">
          {points.map((point) => (
            <span key={`label-${point.key}`} className="truncate text-center">
              {point.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.key}>
            {item.label}: {item.novos} novos, {item.avancaram} avançaram.
          </li>
        ))}
      </ul>
    </section>
  );
}
