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

export type EvangelisticImpactPeriod = "7d" | "30d" | "90d";

export type DecisionsChartGranularity = "day" | "month" | "year";

export type EvangelisticImpactKpis = {
  aceitouJesusTotal: number;
  aceitouJesusPrevious: number;
  aceitouJesusVariationPct: number | null;
  aceitouJesusVariationAbs: number;
  mediaPorCulto: number | null;
  mediaPorCultoPrevious: number | null;
  mediaPorCultoVariationPct: number | null;
  mediaPorCultoVariationAbs: number | null;
  pico: {
    total: number;
    dateLabel: string;
    cultoLabel: string;
  } | null;
};

export type DecisionsTrendPoint = {
  key: string;
  label: string;
  total: number;
  previousTotal: number | null;
  variationPct: number | null;
  variationAbs: number | null;
};

export type OriginImpactRow = {
  origin: "MANHA" | "NOITE" | "MJ" | "QUARTA";
  label: string;
  current: number;
  previous: number;
  sharePct: number;
  variationPct: number | null;
  variationAbs: number;
};
