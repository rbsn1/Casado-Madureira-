import { criticalityRank } from "@/lib/discipleshipCriticality";

export type TurnoOrigem = "MANHA" | "TARDE" | "NOITE" | "NAO_INFORMADO";

export type ModuloOption = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

type SortableCase = {
  criticality: string | null | undefined;
  days_to_confra: number | null | undefined;
  negative_contact_count: number | null | undefined;
  updated_at: string;
};

type TurnoCase = {
  turno_origem: string | null | undefined;
};

type ModuloCase = {
  modulo_atual_id: string | null | undefined;
};

function daysWithoutContactFromUpdatedAt(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

export function normalizeTurnoOrigem(value: string | null | undefined): TurnoOrigem {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!normalized) return "NAO_INFORMADO";
  if (normalized.includes("MANH")) return "MANHA";
  if (normalized.includes("TARDE")) return "TARDE";
  if (normalized.includes("NOITE") || normalized.includes("QUARTA")) return "NOITE";
  if (normalized.includes("EVENT") || normalized.includes("MJ")) return "TARDE";
  return "NAO_INFORMADO";
}

export function groupByTurno<T extends TurnoCase>(items: T[]) {
  const grouped: Record<TurnoOrigem, T[]> = {
    MANHA: [],
    TARDE: [],
    NOITE: [],
    NAO_INFORMADO: []
  };

  for (const item of items) {
    const key = normalizeTurnoOrigem(item.turno_origem);
    grouped[key].push(item);
  }

  return grouped;
}

export function groupByModulo<T extends ModuloCase>(items: T[], modulos: ModuloOption[]) {
  const orderedModulos = [...modulos].sort((a, b) => a.ordem - b.ordem);
  const baseGroups = orderedModulos.map((modulo) => ({
    id: modulo.id,
    nome: modulo.nome,
    ordem: modulo.ordem,
    ativo: modulo.ativo,
    items: [] as T[]
  }));

  const byModuloId = new Map(baseGroups.map((group) => [group.id, group]));
  const semModulo: T[] = [];
  const unknownByModuloId = new Map<string, T[]>();

  for (const item of items) {
    if (!item.modulo_atual_id) {
      semModulo.push(item);
      continue;
    }
    const group = byModuloId.get(item.modulo_atual_id);
    if (group) {
      group.items.push(item);
      continue;
    }
    const current = unknownByModuloId.get(item.modulo_atual_id) ?? [];
    current.push(item);
    unknownByModuloId.set(item.modulo_atual_id, current);
  }

  const unknownGroups = Array.from(unknownByModuloId.entries()).map(([id, cases], index) => ({
    id,
    nome: `Módulo removido (${id.slice(0, 8)})`,
    ordem: 9000 + index,
    ativo: false,
    items: cases
  }));

  const semModuloGroup = {
    id: null,
    nome: "Sem módulo",
    ordem: 10000,
    ativo: false,
    items: semModulo
  };

  return [...baseGroups, ...unknownGroups, semModuloGroup];
}

export function sortCases<T extends SortableCase>(items: T[]) {
  return [...items].sort((a, b) => {
    const rankDiff = criticalityRank(b.criticality) - criticalityRank(a.criticality);
    if (rankDiff !== 0) return rankDiff;

    const aDaysToConfra = a.days_to_confra ?? 999999;
    const bDaysToConfra = b.days_to_confra ?? 999999;
    if (aDaysToConfra !== bDaysToConfra) return aDaysToConfra - bDaysToConfra;

    const negativesDiff = (b.negative_contact_count ?? 0) - (a.negative_contact_count ?? 0);
    if (negativesDiff !== 0) return negativesDiff;

    const noContactDiff = daysWithoutContactFromUpdatedAt(b.updated_at) - daysWithoutContactFromUpdatedAt(a.updated_at);
    if (noContactDiff !== 0) return noContactDiff;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}
