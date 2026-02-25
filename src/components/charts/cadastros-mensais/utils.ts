export type RawChartEntry = {
  month: number;
  label: string;
  value: number;
};

export type NormalizedChartEntry = {
  month: number;
  label: string;
  value: number | null;
  isFuture: boolean;
  previousValue: number | null;
};

export type MoMChange = {
  delta: number | null;
  percent: number | null;
  direction: "up" | "down" | "flat" | "none";
  text: string;
};

export const DEFAULT_MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function calcAvg(total: number, months = 12) {
  if (!Number.isFinite(total) || months <= 0) return 0;
  return total / months;
}

export function findPeak(entries: NormalizedChartEntry[]) {
  if (!entries.length) {
    return { month: 1, label: "Jan", value: 0 };
  }

  return entries.reduce(
    (best, item) => {
      const value = item.value ?? 0;
      if (value > best.value) {
        return { month: item.month, label: item.label, value };
      }
      return best;
    },
    { month: entries[0].month, label: entries[0].label, value: entries[0].value ?? 0 }
  );
}

export function findLastWithData(entries: NormalizedChartEntry[]) {
  const found = [...entries].reverse().find((item) => item.value !== null && item.value > 0);
  if (!found) return null;
  return { month: found.month, label: found.label, value: found.value };
}

export function calcMoMChange(current: number, previous: number | null | undefined): MoMChange {
  if (previous === null || previous === undefined || previous <= 0) {
    return {
      delta: null,
      percent: null,
      direction: "none",
      text: "— vs mês anterior"
    };
  }

  const delta = current - previous;
  const percent = previous === 0 ? null : (delta / previous) * 100;
  const absText = `${delta > 0 ? "+" : ""}${delta}`;
  const pctText = percent === null ? "—" : `${percent > 0 ? "+" : ""}${Math.abs(percent) >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;

  return {
    delta,
    percent,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    text: `${absText} (${pctText}) vs mês anterior`
  };
}

export function normalizeMonthlyData(data: RawChartEntry[], year: number, now = new Date()): NormalizedChartEntry[] {
  const monthMap = new Map<number, RawChartEntry>();
  data.forEach((entry) => monthMap.set(entry.month, entry));

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const base = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const source = monthMap.get(month);
    const isFuture = year > currentYear || (year === currentYear && month > currentMonth);

    return {
      month,
      label: source?.label ?? DEFAULT_MONTH_LABELS[index],
      value: isFuture ? null : sanitizeNumber(source?.value),
      isFuture,
      previousValue: null
    };
  });

  return base.map((entry, index) => {
    let previousValue: number | null = null;

    for (let i = index - 1; i >= 0; i -= 1) {
      const prev = base[i].value;
      if (prev !== null) {
        previousValue = prev;
        break;
      }
    }

    return {
      ...entry,
      previousValue
    };
  });
}

function sanitizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
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
    const cp1x = p1.x + ((p2.x - p0.x) * tension);
    const cp1y = p1.y + ((p2.y - p0.y) * tension);
    const cp2x = p2.x - ((p3.x - p1.x) * tension);
    const cp2y = p2.y - ((p3.y - p1.y) * tension);

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
}
