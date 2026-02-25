"use client";

import { CSSProperties, useId, useMemo, useState } from "react";
import { CustomTooltip } from "@/components/charts/cadastros-mensais/CustomTooltip";
import { NormalizedChartEntry, buildSmoothPath, calcMoMChange } from "@/components/charts/cadastros-mensais/utils";

const VIEWBOX_WIDTH = 120;
const VIEWBOX_HEIGHT = 64;
const PLOT_TOP = 7;
const PLOT_BOTTOM = 48;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const GRID_TICKS = 5;
const BAR_SLOT = VIEWBOX_WIDTH / 12;
const BAR_WIDTH = 5.4;
const BAR_RADIUS = 1.2;
const MOBILE_HEIGHT = 220;
const DESKTOP_HEIGHT = 320;

export function CadastrosComboChart({
  entries,
  year,
  average,
  peak,
  selectedMonth,
  onMonthSelect
}: {
  entries: NormalizedChartEntry[];
  year: number;
  average: number;
  peak: {
    month: number;
    value: number;
  };
  selectedMonth: number | null;
  onMonthSelect?: (month: number | null) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const maxValue = useMemo(
    () => Math.max(1, ...entries.map((entry) => entry.value ?? 0)),
    [entries]
  );

  const points = useMemo(
    () =>
      entries.map((entry, index) => {
        const x = index * BAR_SLOT + BAR_SLOT / 2;
        const value = entry.value;
        const y = value === null ? null : PLOT_BOTTOM - (value / maxValue) * PLOT_HEIGHT;
        const barHeight = value === null ? 0 : (value / maxValue) * PLOT_HEIGHT;
        const barY = PLOT_BOTTOM - barHeight;

        return {
          ...entry,
          x,
          y,
          barX: x - BAR_WIDTH / 2,
          barY,
          barHeight
        };
      }),
    [entries, maxValue]
  );

  const barPaths = useMemo(() => {
    return points.map((point) => {
      if (point.value === null || point.barHeight <= 0) return null;
      return {
        month: point.month,
        path: buildTopRoundedBarPath(point.barX, point.barY, BAR_WIDTH, point.barHeight, BAR_RADIUS)
      };
    });
  }, [points]);

  const lineSegments = useMemo(() => {
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let segment: Array<{ x: number; y: number }> = [];

    points.forEach((point) => {
      if (point.y === null) {
        if (segment.length) segments.push(segment);
        segment = [];
        return;
      }
      segment.push({ x: point.x, y: point.y });
    });

    if (segment.length) segments.push(segment);
    return segments;
  }, [points]);

  const linePath = useMemo(
    () => lineSegments.map((segment) => buildSmoothPath(segment)).join(" "),
    [lineSegments]
  );

  const areaPaths = useMemo(
    () =>
      lineSegments.map((segment) => {
        const smooth = buildSmoothPath(segment);
        const start = segment[0]?.x ?? 0;
        const end = segment[segment.length - 1]?.x ?? 0;
        return `${smooth} L ${end} ${PLOT_BOTTOM} L ${start} ${PLOT_BOTTOM} Z`;
      }),
    [lineSegments]
  );

  const activeMonth = hoveredMonth ?? selectedMonth;

  const activePoint = useMemo(() => {
    if (activeMonth === null) return null;
    const point = points.find((item) => item.month === activeMonth);
    if (!point || point.value === null || point.y === null) return null;
    return {
      ...point,
      value: point.value,
      y: point.y
    };
  }, [activeMonth, points]);

  const activeChange = useMemo(() => {
    if (!activePoint) return calcMoMChange(0, null);
    return calcMoMChange(activePoint.value, activePoint.previousValue);
  }, [activePoint]);

  const peakPoint = useMemo(() => {
    const point = points.find((item) => item.month === peak.month);
    if (!point || point.y === null || point.value === null) return null;
    return point;
  }, [points, peak.month]);

  const averageY = useMemo(
    () => PLOT_BOTTOM - (average / maxValue) * PLOT_HEIGHT,
    [average, maxValue]
  );

  const yTickValues = useMemo(
    () => Array.from({ length: GRID_TICKS }, (_, idx) => Math.round((maxValue * (GRID_TICKS - 1 - idx)) / (GRID_TICKS - 1))),
    [maxValue]
  );

  const chartHeights = useMemo(
    () => ({
      "--cadastros-chart-mobile": `${MOBILE_HEIGHT}px`,
      "--cadastros-chart-desktop": `${DESKTOP_HEIGHT}px`
    } as CSSProperties),
    []
  );

  return (
    <div className="relative mt-4">
      <div
        className="relative h-[var(--cadastros-chart-mobile)] w-full md:h-[var(--cadastros-chart-desktop)]"
        style={chartHeights}
        onMouseLeave={() => setHoveredMonth(null)}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Cadastros mensais ${year}. Gráfico combinado de barras e linha.`}
        >
          <defs>
            <linearGradient id={`cadastrosLineArea-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {yTickValues.map((value, idx) => {
            const y = PLOT_TOP + (idx / (GRID_TICKS - 1)) * PLOT_HEIGHT;
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

          {barPaths.map((entry) => {
            if (!entry) return null;
            const isActive = entry.month === activeMonth;
            const isSelected = entry.month === selectedMonth;
            const opacity = isActive || isSelected ? 0.9 : 0.26;

            return (
              <path
                key={`bar-${entry.month}`}
                d={entry.path}
                fill="#10b981"
                fillOpacity={opacity}
              />
            );
          })}

          {areaPaths.map((pathValue, idx) => (
            <path key={`area-${idx}`} d={pathValue} fill={`url(#cadastrosLineArea-${gradientId})`} />
          ))}

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
            stroke="#059669"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {peakPoint ? (
            <>
              <circle cx={peakPoint.x} cy={peakPoint.y} r={1.8} fill="#059669" fillOpacity="0.18" />
              <circle cx={peakPoint.x} cy={peakPoint.y} r={1} fill="#047857" />
            </>
          ) : null}

          {activePoint ? (
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={1.45}
              fill="#ffffff"
              stroke="#047857"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {points.map((point, index) => {
            const prev = points[index - 1];
            const next = points[index + 1];
            const startX = prev ? (prev.x + point.x) / 2 : 0;
            const endX = next ? (next.x + point.x) / 2 : VIEWBOX_WIDTH;
            const disabled = point.isFuture;

            return (
              <rect
                key={`zone-${point.month}`}
                x={startX}
                y={PLOT_TOP}
                width={endX - startX}
                height={PLOT_HEIGHT}
                fill="transparent"
                onMouseEnter={() => {
                  if (!disabled) setHoveredMonth(point.month);
                }}
                onClick={() => {
                  if (!disabled) onMonthSelect?.(selectedMonth === point.month ? null : point.month);
                }}
                style={{ cursor: disabled ? "default" : "pointer" }}
              />
            );
          })}
        </svg>

        {activePoint ? (
          <CustomTooltip
            monthLabel={activePoint.label}
            year={year}
            value={activePoint.value}
            change={activeChange}
            isPeak={activePoint.month === peak.month}
            leftPercent={Math.max(10, Math.min(90, (activePoint.x / VIEWBOX_WIDTH) * 100))}
          />
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-12 gap-1 text-[10px] sm:text-[11px]">
        {points.map((point) => {
          const isSelected = selectedMonth === point.month;
          const label = point.isFuture ? "—" : point.label;
          return (
            <button
              key={`label-${point.month}`}
              type="button"
              onMouseEnter={() => {
                if (!point.isFuture) setHoveredMonth(point.month);
              }}
              onMouseLeave={() => setHoveredMonth(null)}
              onClick={() => {
                if (!point.isFuture) onMonthSelect?.(isSelected ? null : point.month);
              }}
              className={`rounded-md py-1 text-center transition ${isSelected
                ? "bg-emerald-50 font-semibold text-emerald-900"
                : "text-slate-500 hover:bg-emerald-50/70 hover:text-slate-700"
                }`}
              disabled={point.isFuture}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildTopRoundedBarPath(x: number, y: number, width: number, height: number, radius: number) {
  if (height <= 0 || width <= 0) return "";
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const bottom = y + height;

  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + safeRadius}`,
    `Q ${x} ${y} ${x + safeRadius} ${y}`,
    `L ${right - safeRadius} ${y}`,
    `Q ${right} ${y} ${right} ${y + safeRadius}`,
    `L ${right} ${bottom}`,
    "Z"
  ].join(" ");
}
