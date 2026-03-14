export type CultoOrigemCode =
  | "DOMINGO_MANHA"
  | "DOMINGO_NOITE"
  | "QUARTA"
  | "SEXTA"
  | "EVENTO_ESPECIAL"
  | "CONGRESSO"
  | "OUTRO";

const CULT_CODE_ORDER: CultoOrigemCode[] = [
  "DOMINGO_MANHA",
  "DOMINGO_NOITE",
  "QUARTA",
  "SEXTA",
  "EVENTO_ESPECIAL",
  "CONGRESSO",
  "OUTRO"
];

const CULT_LABEL_BY_CODE: Record<CultoOrigemCode, string> = {
  DOMINGO_MANHA: "Domingo manhã",
  DOMINGO_NOITE: "Domingo noite",
  QUARTA: "Quarta",
  SEXTA: "Sexta",
  EVENTO_ESPECIAL: "Evento especial",
  CONGRESSO: "Congresso",
  OUTRO: "Outro"
};

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function parseCultoOrigemCode(value: string | null | undefined): CultoOrigemCode | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  if (
    normalized === "DOMINGO MANHA" ||
    normalized === "MANHA" ||
    normalized.includes("CULTO DA MANHA") ||
    (normalized.includes("DOMINGO") && normalized.includes("MANHA"))
  ) {
    return "DOMINGO_MANHA";
  }

  if (
    normalized === "DOMINGO NOITE" ||
    normalized === "NOITE" ||
    normalized.includes("CULTO DA NOITE") ||
    (normalized.includes("DOMINGO") && normalized.includes("NOITE"))
  ) {
    return "DOMINGO_NOITE";
  }

  if (normalized === "QUARTA" || normalized.includes("QUARTA")) {
    return "QUARTA";
  }

  if (
    normalized === "SEXTA" ||
    normalized === "MJ" ||
    normalized.includes("CULTO DO MJ") ||
    normalized.includes("SEXTA")
  ) {
    return "SEXTA";
  }

  if (normalized === "CONGRESSO" || normalized.includes("CONGRESSO")) {
    return "CONGRESSO";
  }

  if (
    normalized === "EVENTO ESPECIAL" ||
    normalized.includes("EVENTO ESPECIAL") ||
    normalized.includes("EVENTO")
  ) {
    return "EVENTO_ESPECIAL";
  }

  if (
    normalized === "OUTRO" ||
    normalized === "OUTROS" ||
    normalized.includes("OUTRO") ||
    normalized.includes("CELULA") ||
    normalized.includes("TARDE")
  ) {
    return "OUTRO";
  }

  return null;
}

export function cultoOrigemLabel(value: CultoOrigemCode | null | undefined) {
  if (!value) return "Nao informado";
  return CULT_LABEL_BY_CODE[value];
}

export function cultoOrigemToLegacyOrigem(value: CultoOrigemCode | null | undefined) {
  if (!value) return null;
  return CULT_LABEL_BY_CODE[value];
}

export function cultoOrigemLabelFromValue(value: string | null | undefined) {
  const parsed = parseCultoOrigemCode(value);
  if (parsed) return cultoOrigemLabel(parsed);

  const fallback = String(value ?? "").trim();
  return fallback || "Nao informado";
}

export const CULTO_ORIGEM_OPTIONS = CULT_CODE_ORDER.map((value) => ({
  value,
  label: CULT_LABEL_BY_CODE[value]
}));
