export type DiscipleshipCriticality = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export const NEGATIVE_CONTACT_OUTCOMES = ["no_answer", "wrong_number", "refused", "sem_resposta"] as const;

export type NegativeContactOutcome = (typeof NEGATIVE_CONTACT_OUTCOMES)[number];

export function isNegativeContactOutcome(outcome: string | null | undefined) {
  if (!outcome) return false;
  return NEGATIVE_CONTACT_OUTCOMES.includes(outcome as NegativeContactOutcome);
}

export function normalizeCriticality(value: string | null | undefined): DiscipleshipCriticality {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "CRITICA") return "CRITICA";
  if (normalized === "ALTA") return "ALTA";
  if (normalized === "MEDIA") return "MEDIA";
  return "BAIXA";
}

export function criticalityRank(value: string | null | undefined) {
  const normalized = normalizeCriticality(value);
  if (normalized === "CRITICA") return 4;
  if (normalized === "ALTA") return 3;
  if (normalized === "MEDIA") return 2;
  return 1;
}

export function criticalityLabel(value: string | null | undefined) {
  const normalized = normalizeCriticality(value);
  if (normalized === "MEDIA") return "MÉDIA";
  return normalized;
}
