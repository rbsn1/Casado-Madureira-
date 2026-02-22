export type OperationalStatusCardsModel = {
  em_discipulado: number;
  concluidos: number;
  parados: number;
  pendentes_criticos: number;
  proximos_a_concluir: number;
};

export type ExecutiveKpiPeriod = "today" | "7d" | "30d";

export type ExecutiveKpiModel = {
  novosConvertidos: number;
  previousNovosConvertidos: number;
  variationPct: number | null;
  tempoMedioPrimeiroContato: string | null;
  semContatoSeteDias: number;
  atrasados: number;
};

export type EntryVsProgressPoint = {
  key: string;
  label: string;
  novos: number;
  avancaram: number;
};

export type RiskNowItem = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  href: string;
  cta: string;
  severity: "high" | "medium" | "low";
};

export type RecommendedActionItem = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  href: string;
  cta: string;
};

export type ByAcolhedorRow = {
  id: string;
  name: string;
  total: number;
  criticos: number;
  semContatoSeteDias: number;
};
