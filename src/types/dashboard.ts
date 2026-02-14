
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

export type DiscipleshipCards = {
  em_discipulado: number;
  concluidos: number;
  parados: number;
  pendentes_criticos: number;
  proximos_a_concluir: number;
};

export type Congregation = {
  id: string;
  name: string;
};
