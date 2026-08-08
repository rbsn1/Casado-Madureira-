
export type InsightEntry = { label: string; count: number };

export type GrowthEntry = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
};

export type MonthlyEntry = {
  month: number;
  count: number;
};

export type Congregation = {
  id: string;
  name: string;
};
