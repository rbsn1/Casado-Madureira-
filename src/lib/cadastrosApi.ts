import { type SupabaseClient } from "@supabase/supabase-js";

export type CadastroCompletoStatus = "pendente" | "link_enviado" | "concluido";

export type PessoaItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  culto_origem: string | null;
  data: string | null;
  created_at: string;
  cadastro_completo_status: CadastroCompletoStatus | null;
  cadastro_completo_at: string | null;
};

type PessoaQueryRow = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  culto_origem?: string | null;
  data: string | null;
  created_at: string;
  cadastro_completo_status?: CadastroCompletoStatus | null;
  cadastro_completo_at?: string | null;
};

type QueryFallbackError = {
  message: string;
  code?: string;
};

type PessoasQueryResult = {
  data: unknown[] | null;
  error: QueryFallbackError | null;
};

export type LoadPessoasResult = {
  pessoas: PessoaItem[];
  hasCultoColumn: boolean;
  hasCompletionStatusColumn: boolean;
  errorMessage: string | null;
};

export function isMissingColumnError(message: string, code: string | undefined, column: string) {
  return code === "PGRST204" && message.includes(column);
}

export function getCadastroCompletoLabel(status: CadastroCompletoStatus | null | undefined) {
  if (status === "concluido") return "Cadastro completo";
  if (status === "link_enviado") return "Link enviado";
  return "Pendente de complementação";
}

export function getCadastroCompletoClass(status: CadastroCompletoStatus | null | undefined) {
  if (status === "concluido") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "link_enviado") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export async function loadPessoas(client: SupabaseClient): Promise<LoadPessoasResult> {
  let usingLegacyCulto = false;
  let usingLegacyCompletion = false;

  const loadPessoasQuery = async (columns: string): Promise<PessoasQueryResult> => {
    const result = await client
      .from("pessoas")
      .select(columns)
      .eq("cadastro_origem", "ccm")
      .order("created_at", { ascending: false });

    return {
      data: Array.isArray(result.data) ? (result.data as unknown[]) : null,
      error: result.error
        ? {
            message: result.error.message,
            code: result.error.code
          }
        : null
    };
  };

  let pessoasResult = await loadPessoasQuery(
    "id, nome_completo, telefone_whatsapp, origem, culto_origem, data, created_at, cadastro_completo_status, cadastro_completo_at"
  );

  if (pessoasResult.error && isMissingColumnError(pessoasResult.error.message, pessoasResult.error.code, "culto_origem")) {
    usingLegacyCulto = true;
    pessoasResult = await loadPessoasQuery(
      "id, nome_completo, telefone_whatsapp, origem, data, created_at, cadastro_completo_status, cadastro_completo_at"
    );
  }

  if (
    pessoasResult.error &&
    isMissingColumnError(pessoasResult.error.message, pessoasResult.error.code, "cadastro_completo_status")
  ) {
    usingLegacyCompletion = true;
    pessoasResult = await loadPessoasQuery(
      usingLegacyCulto
        ? "id, nome_completo, telefone_whatsapp, origem, data, created_at"
        : "id, nome_completo, telefone_whatsapp, origem, culto_origem, data, created_at"
    );
  }

  if (pessoasResult.error) {
    return {
      pessoas: [],
      hasCultoColumn: !usingLegacyCulto,
      hasCompletionStatusColumn: !usingLegacyCompletion,
      errorMessage: `Não foi possível carregar os cadastros. ${pessoasResult.error.message}`
    };
  }

  const rows = Array.isArray(pessoasResult.data) ? (pessoasResult.data as PessoaQueryRow[]) : [];

  return {
    pessoas: rows.map((row) => ({
      id: String(row.id),
      nome_completo: String(row.nome_completo ?? ""),
      telefone_whatsapp: row.telefone_whatsapp ?? null,
      origem: row.origem ?? null,
      culto_origem: usingLegacyCulto ? null : row.culto_origem ?? null,
      data: row.data ?? null,
      created_at: String(row.created_at ?? ""),
      cadastro_completo_status: usingLegacyCompletion ? null : row.cadastro_completo_status ?? "pendente",
      cadastro_completo_at: usingLegacyCompletion ? null : row.cadastro_completo_at ?? null
    })),
    hasCultoColumn: !usingLegacyCulto,
    hasCompletionStatusColumn: !usingLegacyCompletion,
    errorMessage: null
  };
}

export async function deletePessoa(client: SupabaseClient, id: string): Promise<{ errorMessage: string | null }> {
  const { error } = await client.from("pessoas").delete().eq("id", id);
  if (error) {
    return { errorMessage: error.message || "Não foi possível excluir o cadastro." };
  }
  return { errorMessage: null };
}

export type GenerateCompletionLinkResult = {
  link: string | null;
  errorMessage: string | null;
};

export async function generateCompletionLink(
  client: SupabaseClient,
  pessoaId: string,
  origin: string
): Promise<GenerateCompletionLinkResult> {
  const { data, error } = await client.rpc("generate_member_completion_token", {
    target_member_id: pessoaId,
    ttl_hours: 168
  });

  if (error || !data) {
    return { link: null, errorMessage: error?.message ?? "Não foi possível gerar o link de cadastro completo." };
  }

  const token = String(data);
  return { link: `${origin}/cadastro/completar?token=${encodeURIComponent(token)}`, errorMessage: null };
}
