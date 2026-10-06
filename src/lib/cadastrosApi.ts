import { type SupabaseClient } from "@supabase/supabase-js";

export type PessoaItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  culto_origem: string | null;
  data: string | null;
  created_at: string;
};

type PessoaQueryRow = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  culto_origem?: string | null;
  data: string | null;
  created_at: string;
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
  errorMessage: string | null;
};

export function isMissingColumnError(message: string, code: string | undefined, column: string) {
  return code === "PGRST204" && message.includes(column);
}

export async function loadPessoas(client: SupabaseClient): Promise<LoadPessoasResult> {
  let usingLegacyCulto = false;

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
    "id, nome_completo, telefone_whatsapp, origem, culto_origem, data, created_at"
  );

  if (pessoasResult.error && isMissingColumnError(pessoasResult.error.message, pessoasResult.error.code, "culto_origem")) {
    usingLegacyCulto = true;
    pessoasResult = await loadPessoasQuery(
      "id, nome_completo, telefone_whatsapp, origem, data, created_at"
    );
  }

  if (pessoasResult.error) {
    return {
      pessoas: [],
      hasCultoColumn: !usingLegacyCulto,
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
      created_at: String(row.created_at ?? "")
    })),
    hasCultoColumn: !usingLegacyCulto,
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
