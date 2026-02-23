import { getAuthScope } from "@/lib/authScope";
import { supabaseClient } from "@/lib/supabaseClient";

export type CultoOrigemKey = "MANHA" | "NOITE" | "EVENTO" | "NAO_INFORMADO";
export type ConfraternizacaoStatus = "ativa" | "futura" | "encerrada";

export type ConfraternizacaoItem = {
  id: string;
  congregation_id: string;
  titulo: string;
  data_evento: string;
  status: ConfraternizacaoStatus;
};

type LoadConfraternizacoesOptions = {
  targetCongregationId?: string | null;
};

function isMissingActiveConfraternizacaoFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("get_active_confraternizacao");
}

function statusRank(status: ConfraternizacaoStatus) {
  if (status === "ativa") return 0;
  if (status === "futura") return 1;
  return 2;
}

function deriveConfraternizacaoStatus(value: string | null | undefined): ConfraternizacaoStatus {
  if (!value) return "encerrada";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "encerrada";

  const now = new Date();
  const date = new Date(time);
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (sameDay) return "ativa";
  if (time > now.getTime()) return "futura";
  return "encerrada";
}

function normalizeConfraternizacaoRow(row: unknown): ConfraternizacaoItem | null {
  const item = row as Partial<ConfraternizacaoItem>;
  if (!item?.id || !item?.congregation_id || !item?.data_evento) return null;

  const derivedStatus = deriveConfraternizacaoStatus(item.data_evento);
  const status = (item.status ?? derivedStatus) as ConfraternizacaoStatus;

  return {
    id: String(item.id),
    congregation_id: String(item.congregation_id),
    titulo: String(item.titulo ?? "Confraternização"),
    data_evento: String(item.data_evento),
    status: status === "ativa" || status === "futura" || status === "encerrada" ? status : derivedStatus
  };
}

export function normalizeCultoOrigem(value: string | null | undefined): CultoOrigemKey {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!normalized) return "NAO_INFORMADO";
  if (normalized.includes("MANH")) return "MANHA";
  if (normalized.includes("NOITE") || normalized.includes("QUARTA")) return "NOITE";
  if (normalized.includes("EVENT") || normalized.includes("MJ")) return "EVENTO";
  return "NAO_INFORMADO";
}

export function cultoOrigemLabel(value: CultoOrigemKey) {
  if (value === "MANHA") return "Culto da Manhã";
  if (value === "NOITE") return "Culto da Noite";
  if (value === "EVENTO") return "Evento";
  return "Não informado";
}

export async function loadConfraternizacoes(options: LoadConfraternizacoesOptions = {}) {
  if (!supabaseClient) {
    return { data: [] as ConfraternizacaoItem[], errorMessage: "Supabase não configurado." };
  }

  const { targetCongregationId = null } = options;
  const scope = await getAuthScope();
  const effectiveCongregationId =
    targetCongregationId && (scope.isAdminMaster || scope.congregationId === targetCongregationId)
      ? targetCongregationId
      : scope.congregationId;

  let query = supabaseClient
    .from("confraternizacoes")
    .select("id, congregation_id, titulo, data_evento, status")
    .order("data_evento", { ascending: true });

  if (effectiveCongregationId) {
    query = query.eq("congregation_id", effectiveCongregationId);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [] as ConfraternizacaoItem[], errorMessage: error.message };
  }

  const normalized = (data ?? [])
    .map((row) => normalizeConfraternizacaoRow(row))
    .filter((row): row is ConfraternizacaoItem => row !== null)
    .sort((a, b) => {
      const dateDiff = new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime();
      if (dateDiff !== 0) return dateDiff;
      return statusRank(a.status) - statusRank(b.status);
    });

  return { data: normalized, errorMessage: "" };
}

export async function loadActiveConfraternizacao(targetCongregationId?: string | null) {
  if (!supabaseClient) {
    return { data: null as ConfraternizacaoItem | null, errorMessage: "Supabase não configurado." };
  }

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc("get_active_confraternizacao", {
    target_congregation_id: targetCongregationId ?? null
  });

  if (!rpcError) {
    const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
    const item = rows
      .map((row) => normalizeConfraternizacaoRow(row))
      .find((row): row is ConfraternizacaoItem => row !== null);
    if (item) {
      return { data: item, errorMessage: "" };
    }
  }

  if (rpcError && !isMissingActiveConfraternizacaoFunctionError(rpcError.message, rpcError.code)) {
    return { data: null as ConfraternizacaoItem | null, errorMessage: rpcError.message };
  }

  const { data: allConfraternizacoes, errorMessage } = await loadConfraternizacoes({
    targetCongregationId: targetCongregationId ?? null
  });

  if (errorMessage) {
    return { data: null as ConfraternizacaoItem | null, errorMessage };
  }

  if (!allConfraternizacoes.length) {
    return { data: null as ConfraternizacaoItem | null, errorMessage: "" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeOrUpcoming = [...allConfraternizacoes]
    .filter((item) => {
      const date = new Date(item.data_evento);
      date.setHours(0, 0, 0, 0);
      return date.getTime() >= today.getTime();
    })
    .sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime());

  const fallback =
    [...allConfraternizacoes]
      .sort((a, b) => {
        const rankDiff = statusRank(a.status) - statusRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime();
      })[0] ?? null;

  return {
    data: activeOrUpcoming[0] ?? fallback,
    errorMessage: ""
  };
}
