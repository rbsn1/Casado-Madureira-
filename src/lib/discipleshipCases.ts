import { supabaseClient } from "@/lib/supabaseClient";

export type DiscipleshipCaseStatus = "pendente_matricula" | "em_discipulado" | "concluido" | "pausado";

export type DiscipleshipCaseSummaryItem = {
  case_id: string;
  member_id: string;
  member_name: string;
  member_phone: string | null;
  assigned_to: string | null;
  discipulador_email: string | null;
  status: DiscipleshipCaseStatus;
  notes: string | null;
  updated_at: string;
  done_modules: number;
  total_modules: number;
  criticality: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  negative_contact_count: number;
  days_to_confra: number | null;
};

type FallbackCaseRow = {
  id: string;
  member_id: string;
  assigned_to: string | null;
  status: DiscipleshipCaseStatus;
  notes: string | null;
  updated_at: string;
  criticality?: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA" | null;
  negative_contact_count?: number | null;
  days_to_confra?: number | null;
};

function isMissingListCasesFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("list_discipleship_cases_summary");
}

function isMissingCriticalityColumnsError(message: string, code?: string) {
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("criticality") ||
    message.includes("negative_contact_count") ||
    message.includes("days_to_confra")
  );
}

export async function loadDiscipleshipCaseSummariesWithFallback() {
  if (!supabaseClient) {
    return {
      data: [] as DiscipleshipCaseSummaryItem[],
      errorMessage: "Supabase não configurado.",
      hasCriticalityColumns: false
    };
  }

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc("list_discipleship_cases_summary", {
    status_filter: null,
    target_congregation_id: null,
    rows_limit: 500
  });

  if (!rpcError) {
    const rows: unknown[] = Array.isArray(rpcData) ? rpcData : [];
    const normalized = rows.map((row) => {
      const item = row as Partial<DiscipleshipCaseSummaryItem>;
      return {
        case_id: String(item.case_id ?? ""),
        member_id: String(item.member_id ?? ""),
        member_name: String(item.member_name ?? "Membro"),
        member_phone: item.member_phone ?? null,
        assigned_to: item.assigned_to ?? null,
        discipulador_email: item.discipulador_email ?? null,
        status: (item.status ?? "pendente_matricula") as DiscipleshipCaseStatus,
        notes: item.notes ?? null,
        updated_at: String(item.updated_at ?? new Date().toISOString()),
        done_modules: Number(item.done_modules ?? 0),
        total_modules: Number(item.total_modules ?? 0),
        criticality: (item.criticality ?? "BAIXA") as DiscipleshipCaseSummaryItem["criticality"],
        negative_contact_count: Number(item.negative_contact_count ?? 0),
        days_to_confra: item.days_to_confra ?? null
      } satisfies DiscipleshipCaseSummaryItem;
    });
    return { data: normalized, errorMessage: "", hasCriticalityColumns: true };
  }

  if (!isMissingListCasesFunctionError(rpcError.message, rpcError.code)) {
    return { data: [] as DiscipleshipCaseSummaryItem[], errorMessage: rpcError.message, hasCriticalityColumns: false };
  }

  const baseSelect =
    "id, member_id, assigned_to, status, notes, updated_at, criticality, negative_contact_count, days_to_confra";
  let hasCriticalityColumns = true;
  let casesResult: {
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  } = await supabaseClient
    .from("discipleship_cases")
    .select(baseSelect)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (casesResult.error && isMissingCriticalityColumnsError(casesResult.error.message, casesResult.error.code)) {
    hasCriticalityColumns = false;
    casesResult = await supabaseClient
      .from("discipleship_cases")
      .select("id, member_id, assigned_to, status, notes, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);
  }

  if (casesResult.error) {
    return { data: [] as DiscipleshipCaseSummaryItem[], errorMessage: casesResult.error.message, hasCriticalityColumns };
  }

  const baseCases = (casesResult.data ?? []) as FallbackCaseRow[];
  if (!baseCases.length) {
    return { data: [] as DiscipleshipCaseSummaryItem[], errorMessage: "", hasCriticalityColumns };
  }

  const memberIds = [...new Set(baseCases.map((item) => item.member_id))];
  const caseIds = baseCases.map((item) => item.id);

  const [{ data: membersData, error: membersError }, { data: progressData, error: progressError }] = await Promise.all([
    supabaseClient.from("pessoas").select("id, nome_completo, telefone_whatsapp").in("id", memberIds),
    supabaseClient.from("discipleship_progress").select("case_id, status").in("case_id", caseIds)
  ]);

  if (membersError) {
    return { data: [] as DiscipleshipCaseSummaryItem[], errorMessage: membersError.message, hasCriticalityColumns };
  }
  if (progressError) {
    return { data: [] as DiscipleshipCaseSummaryItem[], errorMessage: progressError.message, hasCriticalityColumns };
  }

  const memberMap = new Map(
    (membersData ?? []).map((member) => [
      member.id,
      {
        name: member.nome_completo,
        phone: member.telefone_whatsapp as string | null
      }
    ])
  );

  const progressMap = new Map<string, { done: number; total: number }>();
  for (const item of progressData ?? []) {
    const current = progressMap.get(item.case_id) ?? { done: 0, total: 0 };
    current.total += 1;
    if (item.status === "concluido") current.done += 1;
    progressMap.set(item.case_id, current);
  }

  const summaries: DiscipleshipCaseSummaryItem[] = baseCases.map((item) => {
    const member = memberMap.get(item.member_id);
    const progress = progressMap.get(item.id) ?? { done: 0, total: 0 };
    return {
      case_id: item.id,
      member_id: item.member_id,
      member_name: member?.name ?? "Membro",
      member_phone: member?.phone ?? null,
      assigned_to: item.assigned_to ?? null,
      discipulador_email: item.assigned_to ? `ID ${item.assigned_to.slice(0, 8)}` : null,
      status: item.status,
      notes: item.notes,
      updated_at: item.updated_at,
      done_modules: progress.done,
      total_modules: progress.total,
      criticality: item.criticality ?? "BAIXA",
      negative_contact_count: item.negative_contact_count ?? 0,
      days_to_confra: item.days_to_confra ?? null
    };
  });

  return { data: summaries, errorMessage: "", hasCriticalityColumns };
}
