import { downloadCsv } from "@/lib/csv";
import { supabaseClient } from "@/lib/supabaseClient";

export type TurmaTurno = "MANHA" | "TARDE" | "NOITE" | "NAO_INFORMADO";
export type ChamadaStatus = "PRESENTE" | "FALTA" | "JUSTIFICADA";

export type TurmaOption = {
  id: string;
  nome: string;
  turno: TurmaTurno;
};

export type AulaRecord = {
  id: string;
  turma_id: string;
  data: string;
  tema: string | null;
  modulo_id: string | null;
};

export type ChamadaAluno = {
  alunoId: string;
  nome: string;
};

export type ChamadaItemRecord = {
  aula_id: string;
  aluno_id: string;
  status: ChamadaStatus | null;
  observacao: string | null;
  marcado_em: string | null;
  marcado_por: string | null;
};

function sanitizeFileNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export async function loadTurmas(targetCongregationId?: string | null) {
  if (!supabaseClient) {
    return { data: [] as TurmaOption[], errorMessage: "Supabase não configurado." };
  }

  let query = supabaseClient
    .from("discipleship_turmas")
    .select("id, nome, turno")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (targetCongregationId) {
    query = query.eq("congregation_id", targetCongregationId);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [] as TurmaOption[], errorMessage: error.message };
  }

  const rows = (data ?? []) as Array<{ id: string; nome: string | null; turno: string | null }>;
  return {
    data: rows.map((row) => ({
      id: String(row.id),
      nome: String(row.nome ?? "Turma"),
      turno: (String(row.turno ?? "NAO_INFORMADO") as TurmaTurno)
    })),
    errorMessage: ""
  };
}

export async function loadTurmaAlunos(turmaId: string) {
  if (!supabaseClient) {
    return { data: [] as ChamadaAluno[], errorMessage: "Supabase não configurado." };
  }

  const { data: turmaAlunoRows, error: turmaAlunoError } = await supabaseClient
    .from("discipleship_turma_alunos")
    .select("aluno_id")
    .eq("turma_id", turmaId);

  if (turmaAlunoError) {
    return { data: [] as ChamadaAluno[], errorMessage: turmaAlunoError.message };
  }

  const alunoIds = [...new Set((turmaAlunoRows ?? []).map((row) => String((row as { aluno_id: string }).aluno_id)))];
  if (!alunoIds.length) {
    return { data: [] as ChamadaAluno[], errorMessage: "" };
  }

  const { data: peopleRows, error: peopleError } = await supabaseClient
    .from("pessoas")
    .select("id, nome_completo")
    .in("id", alunoIds)
    .order("nome_completo", { ascending: true });

  if (peopleError) {
    return { data: [] as ChamadaAluno[], errorMessage: peopleError.message };
  }

  const people = (peopleRows ?? []) as Array<{ id: string; nome_completo: string | null }>;
  return {
    data: people.map((row) => ({
      alunoId: String(row.id),
      nome: String(row.nome_completo ?? "Aluno")
    })),
    errorMessage: ""
  };
}

export async function getOrCreateAula(args: {
  turmaId: string;
  date: string;
  tema?: string;
  moduloId?: string | null;
  marcadoPor?: string | null;
}) {
  if (!supabaseClient) {
    return { data: null as AulaRecord | null, errorMessage: "Supabase não configurado." };
  }

  const payload = {
    turma_id: args.turmaId,
    data: args.date,
    tema: args.tema?.trim() ? args.tema.trim() : null,
    modulo_id: args.moduloId ?? null,
    created_by: args.marcadoPor ?? null
  };

  const { data, error } = await supabaseClient
    .from("discipleship_aulas")
    .upsert(payload, { onConflict: "turma_id,data" })
    .select("id, turma_id, data, tema, modulo_id")
    .single();

  if (error) {
    return { data: null as AulaRecord | null, errorMessage: error.message };
  }

  return {
    data: data as AulaRecord,
    errorMessage: ""
  };
}

export async function loadChamadaItens(aulaId: string) {
  if (!supabaseClient) {
    return { data: [] as ChamadaItemRecord[], errorMessage: "Supabase não configurado." };
  }

  const { data, error } = await supabaseClient
    .from("discipleship_chamada_itens")
    .select("aula_id, aluno_id, status, observacao, marcado_em, marcado_por")
    .eq("aula_id", aulaId);

  if (error) {
    return { data: [] as ChamadaItemRecord[], errorMessage: error.message };
  }

  return { data: (data ?? []) as ChamadaItemRecord[], errorMessage: "" };
}

export async function upsertChamadaItem(args: {
  aulaId: string;
  alunoId: string;
  status: ChamadaStatus | null;
  observacao?: string | null;
  marcadoPor?: string | null;
}) {
  if (!supabaseClient) {
    return { data: null as ChamadaItemRecord | null, errorMessage: "Supabase não configurado." };
  }

  const observacao = args.observacao?.trim() ? args.observacao.trim() : null;
  const payload = {
    aula_id: args.aulaId,
    aluno_id: args.alunoId,
    status: args.status,
    observacao,
    marcado_em: new Date().toISOString(),
    marcado_por: args.marcadoPor ?? null
  };

  const { data, error } = await supabaseClient
    .from("discipleship_chamada_itens")
    .upsert(payload, { onConflict: "aula_id,aluno_id" })
    .select("aula_id, aluno_id, status, observacao, marcado_em, marcado_por")
    .single();

  if (error) {
    return { data: null as ChamadaItemRecord | null, errorMessage: error.message };
  }

  return { data: data as ChamadaItemRecord, errorMessage: "" };
}

export function exportChamadaCSV(args: {
  turmaNome: string;
  data: string;
  tema?: string | null;
  rows: Array<{
    nome: string;
    status: ChamadaStatus | null;
    observacao?: string | null;
  }>;
}) {
  const fileDate = args.data;
  const turmaSlug = sanitizeFileNamePart(args.turmaNome || "turma");
  const filename = `chamada_${turmaSlug}_${fileDate}.csv`;
  const tema = args.tema?.trim() ? args.tema.trim() : "-";

  const bodyRows = args.rows.map((row) => [
    args.turmaNome,
    fileDate,
    tema,
    row.nome,
    row.status ?? "",
    row.observacao?.trim() ?? ""
  ]);

  downloadCsv(filename, ["Turma", "Data", "Tema", "Nome", "Status", "Observação"], bodyRows, { withBom: true });
}
