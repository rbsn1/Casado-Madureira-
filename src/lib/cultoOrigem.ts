export type CultoOrigemCode = "MANHA" | "NOITE" | "MJ" | "QUARTA" | "OUTROS";

const CULT_CODE_ORDER: CultoOrigemCode[] = ["MANHA", "NOITE", "MJ", "QUARTA", "OUTROS"];

const CULT_LABEL_BY_CODE: Record<CultoOrigemCode, string> = {
  MANHA: "Culto da Manhã",
  NOITE: "Culto da Noite",
  MJ: "Culto do MJ",
  QUARTA: "Culto de Quarta",
  OUTROS: "Outros eventos"
};

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function parseCultoOrigemCode(value: string | null | undefined): CultoOrigemCode | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  if (normalized === "MANHA" || normalized.includes("MANHA")) return "MANHA";
  if (normalized === "NOITE" || normalized.includes("NOITE")) return "NOITE";
  if (normalized === "QUARTA" || normalized.includes("QUARTA")) return "QUARTA";
  if (normalized === "MJ" || normalized.includes("CULTODOMJ") || normalized.endsWith("MJ")) return "MJ";
  if (
    normalized === "OUTROS" ||
    normalized.includes("OUTRO") ||
    normalized.includes("EVENT") ||
    normalized.includes("TARDE")
  ) {
    return "OUTROS";
  }

  return null;
}

export function cultoOrigemLabel(value: CultoOrigemCode | null | undefined) {
  if (!value) return "Não informado";
  return CULT_LABEL_BY_CODE[value];
}

export function cultoOrigemToLegacyOrigem(value: CultoOrigemCode | null | undefined) {
  if (!value) return null;
  return CULT_LABEL_BY_CODE[value];
}

export const CULTO_ORIGEM_OPTIONS = CULT_CODE_ORDER.map((value) => ({
  value,
  label: CULT_LABEL_BY_CODE[value]
}));
