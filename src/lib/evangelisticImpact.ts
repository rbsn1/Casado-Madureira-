export type DecisionOrigin = "MANHA" | "NOITE" | "MJ" | "QUARTA";

export type EvangelisticDecisionRecord = {
  acceptedAt: string;
  origin: DecisionOrigin | null;
};

export type GroupedPeriodPoint = {
  key: string;
  label: string;
  total: number;
};

export type GroupedOriginPoint = {
  origin: DecisionOrigin;
  total: number;
};

const ORIGIN_ORDER: DecisionOrigin[] = ["MANHA", "NOITE", "MJ", "QUARTA"];

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function parseTimestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatMonthLabel(date: Date) {
  const monthRaw = monthFormatter.format(date).replace(".", "");
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1).toLowerCase();
  return `${month}/${date.getFullYear()}`;
}

function formatDayLabel(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function sortByKeyAsc<T extends { key: string }>(items: T[]) {
  return [...items].sort((a, b) => a.key.localeCompare(b.key));
}

export function groupByDay(records: EvangelisticDecisionRecord[]): GroupedPeriodPoint[] {
  const grouped = new Map<string, number>();

  for (const record of records) {
    const timestamp = parseTimestamp(record.acceptedAt);
    if (timestamp === null) continue;
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return sortByKeyAsc(
    [...grouped.entries()].map(([key, total]) => {
      const date = new Date(`${key}T12:00:00`);
      return {
        key,
        label: formatDayLabel(date),
        total
      };
    })
  );
}

export function groupByMonth(records: EvangelisticDecisionRecord[]): GroupedPeriodPoint[] {
  const grouped = new Map<string, number>();

  for (const record of records) {
    const timestamp = parseTimestamp(record.acceptedAt);
    if (timestamp === null) continue;
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return sortByKeyAsc(
    [...grouped.entries()].map(([key, total]) => {
      const [year, month] = key.split("-").map(Number);
      const date = new Date(year, (month ?? 1) - 1, 1);
      return {
        key,
        label: formatMonthLabel(date),
        total
      };
    })
  );
}

export function groupByYear(records: EvangelisticDecisionRecord[]): GroupedPeriodPoint[] {
  const grouped = new Map<string, number>();

  for (const record of records) {
    const timestamp = parseTimestamp(record.acceptedAt);
    if (timestamp === null) continue;
    const year = String(new Date(timestamp).getFullYear());
    grouped.set(year, (grouped.get(year) ?? 0) + 1);
  }

  return sortByKeyAsc(
    [...grouped.entries()].map(([key, total]) => ({
      key,
      label: key,
      total
    }))
  );
}

export function groupByOrigin(records: EvangelisticDecisionRecord[]): GroupedOriginPoint[] {
  const grouped = new Map<DecisionOrigin, number>(
    ORIGIN_ORDER.map((origin) => [origin, 0])
  );

  for (const record of records) {
    if (!record.origin) continue;
    grouped.set(record.origin, (grouped.get(record.origin) ?? 0) + 1);
  }

  return ORIGIN_ORDER.map((origin) => ({
    origin,
    total: grouped.get(origin) ?? 0
  }));
}

export function calculateMediaPorCulto(totalDecisoesPeriodo: number, totalCultosPeriodo: number) {
  if (totalCultosPeriodo <= 0) return null;
  return totalDecisoesPeriodo / totalCultosPeriodo;
}
