export type SundayScaleCulto = "DOMINGO_MANHA" | "DOMINGO_NOITE";
export type SundayScalePresenceStatus = "pendente" | "confirmado" | "nao_podera_ir";

export type SundayScaleUserOption = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  roles: string[];
};

export type SundayScaleItem = {
  id: string;
  culto: SundayScaleCulto;
  data: string;
  horario: string;
  created_at?: string | null;
};

export type SundayScaleAssignmentView = {
  id: string;
  scaleId: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  culto: SundayScaleCulto;
  data: string;
  horario: string;
  status: SundayScalePresenceStatus;
  respondidoEm: string | null;
};

export const SUNDAY_SCALE_CULTO_OPTIONS: Array<{ value: SundayScaleCulto; label: string }> = [
  { value: "DOMINGO_MANHA", label: "Culto da Manhã" },
  { value: "DOMINGO_NOITE", label: "Culto da Noite" }
];

export const SUNDAY_SCALE_STATUS_OPTIONS: Array<{ value: SundayScalePresenceStatus | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "pendente", label: "Pendente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "nao_podera_ir", label: "Não poderá ir" }
];

export const SUNDAY_SCALE_LEADERSHIP_ROLES = ["ADMIN_MASTER", "SUPER_ADMIN", "PASTOR", "SECRETARIA", "LIDER_DEPTO"] as const;
export const SUNDAY_SCALE_PORTAL_ROLES = [
  "ADMIN_MASTER",
  "SUPER_ADMIN",
  "PASTOR",
  "SECRETARIA",
  "NOVOS_CONVERTIDOS",
  "LIDER_DEPTO",
  "VOLUNTARIO",
  "CADASTRADOR"
] as const;

export function sundayScaleCultoLabel(value: string | null | undefined) {
  if (value === "DOMINGO_MANHA") return "Culto da Manhã";
  if (value === "DOMINGO_NOITE") return "Culto da Noite";
  return "Culto não informado";
}

export function sundayScaleStatusLabel(value: string | null | undefined) {
  if (value === "confirmado") return "Confirmado";
  if (value === "nao_podera_ir") return "Não poderá ir";
  return "Pendente";
}

export function sundayScaleStatusClasses(value: string | null | undefined) {
  if (value === "confirmado") {
    return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 shadow-sm";
  }
  if (value === "nao_podera_ir") {
    return "bg-rose-50 text-rose-800 ring-1 ring-rose-200 shadow-sm";
  }
  return "bg-amber-50 text-amber-900 ring-1 ring-amber-200 shadow-sm";
}

export function isSundayScaleLeader(roles: string[], isAdminMaster: boolean) {
  if (isAdminMaster) return true;
  return roles.some((role) => SUNDAY_SCALE_LEADERSHIP_ROLES.includes(role as (typeof SUNDAY_SCALE_LEADERSHIP_ROLES)[number]));
}

export function hasSundayScalePortalAccess(roles: string[], isAdminMaster: boolean) {
  if (isAdminMaster) return true;
  return roles.some((role) => SUNDAY_SCALE_PORTAL_ROLES.includes(role as (typeof SUNDAY_SCALE_PORTAL_ROLES)[number]));
}

export function formatScaleTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

export function normalizeSundayScaleErrorMessage(message: string) {
  if (!message) return "Erro inesperado ao processar a escala.";
  if (message === "not allowed") {
    return "Seu perfil não tem permissão para executar esta ação na escala de domingo.";
  }
  if (message === "congregation inactive") {
    return "A congregação vinculada ao usuário está inativa.";
  }
  if (message.includes("outside the base") || message.includes("fora da base") || message.includes("ativo no CCM")) {
    return "Só é permitido vincular usuários já cadastrados e ativos no portal CCM.";
  }
  return message;
}

export function sortSundayScaleAssignments(items: SundayScaleAssignmentView[]) {
  return [...items].sort((a, b) => {
    const dateA = `${a.data}T${a.horario}`;
    const dateB = `${b.data}T${b.horario}`;
    return dateA.localeCompare(dateB) || a.userName.localeCompare(b.userName, "pt-BR");
  });
}

export function deriveUserDisplayName(email: string | null | undefined, metadata?: Record<string, unknown> | null) {
  const metaName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : typeof metadata?.display_name === "string"
          ? metadata.display_name
          : null;

  if (metaName && metaName.trim()) {
    return metaName.trim();
  }

  const localPart = (email ?? "").split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Usuário CCM";

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}
