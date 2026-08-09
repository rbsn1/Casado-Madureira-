import { type SupabaseClient } from "@supabase/supabase-js";
import { readSheet } from "read-excel-file/browser";
import { parseCsv } from "@/lib/csv";
import {
  CultoOrigemCode,
  cultoOrigemToLegacyOrigem,
  parseCultoOrigemCode
} from "@/lib/cultoOrigem";
import { parseBrazilPhone } from "@/lib/phone";
import { createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
import { isMissingColumnError, type CadastroCompletoStatus } from "@/lib/cadastrosApi";

type ImportCadastroItem = {
  sourceLine: number;
  nome_completo: string;
  telefone_whatsapp: string;
  data: string;
  culto_origem: CultoOrigemCode;
  cadastro_completo_status: CadastroCompletoStatus;
  created_at: string;
  updated_at: string;
  request_id: string;
};

export type ImportCadastrosResult = {
  tone: "error" | "success";
  message: string;
};

export type ImportCadastrosOptions = {
  canManageCadastrosDirectly: boolean;
  hasCultoColumn: boolean;
  hasCompletionStatusColumn: boolean;
};

function isMissingRequestIdColumnError(message: string, code?: string) {
  return isMissingColumnError(message, code, "request_id");
}

function toTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeImportDate(value: string | number | Date | null | undefined) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${toTwoDigits(value.getMonth() + 1)}-${toTwoDigits(value.getDate())}`;
  }

  if (typeof value === "number") {
    // Serial de data do Excel (dias desde 1899-12-30). Caso raro hoje em dia
    // com read-excel-file, que já devolve Date para células formatadas como
    // data — mantido para números "crus" digitados em célula de texto.
    if (!Number.isFinite(value)) return null;
    const excelEpochMs = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpochMs + Math.round(value) * 86_400_000);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${toTwoDigits(date.getUTCMonth() + 1)}-${toTwoDigits(date.getUTCDate())}`;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return normalizeImportDate(Number(raw));
  }

  const slashDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const first = Number(slashDate[1]);
    const second = Number(slashDate[2]);
    const year = Number(slashDate[3]);
    if (!first || !second || !year) return null;

    let day = first;
    let month = second;
    if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${toTwoDigits(month)}-${toTwoDigits(day)}`;
  }

  const dashedDate = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashedDate) {
    const day = Number(dashedDate[1]);
    const month = Number(dashedDate[2]);
    const year = Number(dashedDate[3]);
    if (!day || !month || !year) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${toTwoDigits(month)}-${toTwoDigits(day)}`;
  }

  return null;
}

function isoDateToManausCreatedAt(isoDate: string) {
  return `${isoDate}T12:00:00-04:00`;
}

function parseCadastroCompletoStatus(value: string | null | undefined): CadastroCompletoStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "concluido" || normalized === "concluído") return "concluido";
  if (normalized === "link_enviado" || normalized === "link enviado") return "link_enviado";
  return "pendente";
}

type ImportCell = string | number | boolean | Date | null;

async function parseImportFile(file: File): Promise<{ headers: string[]; rows: ImportCell[][] }> {
  const isExcel = file.name.toLowerCase().endsWith(".xlsx");

  if (isExcel) {
    const data = await readSheet(file);
    const rows = (data as unknown as ImportCell[][])
      .map((row) => row.map((cell) => (cell === undefined ? null : cell)))
      .filter((row) => row.some((cell) => cell !== null && String(cell).trim().length > 0));
    const headerRow = rows[0] ?? [];
    return {
      headers: headerRow.map((cell) => String(cell ?? "").trim()),
      rows: rows.slice(1)
    };
  }

  return parseCsv(await file.text());
}

function buildImportPayload(headers: string[], rows: ImportCell[][]) {
  const headerIndex = headers.reduce<Record<string, number>>((acc, header, index) => {
    acc[String(header).toLowerCase()] = index;
    return acc;
  }, {});

  const skippedRows: number[] = [];
  const invalidPhoneRows: number[] = [];

  const payload = rows
    .map((row, index) => {
      const line = index + 2;
      const nomeValue = String(row[headerIndex.nome_completo] ?? row[headerIndex.nome] ?? "").trim();
      const contatoValue = String(
        row[headerIndex.contato] ?? row[headerIndex.telefone_whatsapp] ?? row[headerIndex.telefone] ?? ""
      ).trim();
      const cultoValue = String(
        row[headerIndex.culto] ?? row[headerIndex.culto_origem] ?? row[headerIndex.origem] ?? row[headerIndex.turno] ?? ""
      ).trim();
      const rawDateCell = row[headerIndex.data] ?? row[headerIndex.criado_em] ?? row[headerIndex.created_at] ?? null;

      if (!nomeValue || !contatoValue || !cultoValue || !rawDateCell) {
        skippedRows.push(line);
        return null;
      }

      const telefoneParsed = parseBrazilPhone(contatoValue);
      if (!telefoneParsed) {
        invalidPhoneRows.push(line);
        return null;
      }

      const cultoParsed = parseCultoOrigemCode(cultoValue);
      if (!cultoParsed) {
        skippedRows.push(line);
        return null;
      }

      const isoDate = normalizeImportDate(rawDateCell as string | number | Date | null);
      if (!isoDate) {
        skippedRows.push(line);
        return null;
      }

      const item: ImportCadastroItem = {
        sourceLine: line,
        nome_completo: nomeValue,
        telefone_whatsapp: telefoneParsed.formatted,
        data: isoDate,
        culto_origem: cultoParsed,
        created_at: isoDateToManausCreatedAt(isoDate),
        updated_at: isoDateToManausCreatedAt(isoDate),
        request_id: crypto.randomUUID(),
        cadastro_completo_status: parseCadastroCompletoStatus(
          String(row[headerIndex.status_cadastro] ?? row[headerIndex.status] ?? "pendente")
        )
      };

      return item;
    })
    .filter((item): item is ImportCadastroItem => item !== null);

  return { payload, skippedRows, invalidPhoneRows };
}

async function submitImportPayload(
  client: SupabaseClient,
  payload: ImportCadastroItem[],
  options: ImportCadastrosOptions
): Promise<{ errorMessage: string | null }> {
  if (options.canManageCadastrosDirectly) {
    let insertPayload = payload.map((item) => {
      const rowPayload: Record<string, unknown> = {
        nome_completo: item.nome_completo,
        telefone_whatsapp: item.telefone_whatsapp,
        origem: cultoOrigemToLegacyOrigem(item.culto_origem),
        data: item.data,
        created_at: item.created_at,
        updated_at: item.updated_at,
        request_id: item.request_id
      };

      if (options.hasCultoColumn) {
        rowPayload.culto_origem = item.culto_origem;
      }

      if (options.hasCompletionStatusColumn) {
        rowPayload.cadastro_completo_status = item.cadastro_completo_status;
      }

      return rowPayload;
    });

    let { error } = await client.from("pessoas").insert(insertPayload);
    if (error && isMissingRequestIdColumnError(error.message, error.code)) {
      insertPayload = insertPayload.map(({ request_id: _requestId, ...rest }) => rest);
      ({ error } = await client.from("pessoas").insert(insertPayload));
    }

    if (error) {
      return { errorMessage: error.message };
    }
    return { errorMessage: null };
  }

  for (const item of payload) {
    const result = await createQuickCcmRegistration(client, {
      fullName: item.nome_completo,
      phoneWhatsapp: item.telefone_whatsapp,
      registeredOn: item.data,
      cultoOrigem: item.culto_origem,
      requestId: item.request_id
    });

    if (result.errorMessage) {
      return { errorMessage: `Falha na linha ${item.sourceLine}: ${result.errorMessage}` };
    }
  }

  return { errorMessage: null };
}

export async function importCadastrosFile(
  client: SupabaseClient,
  file: File,
  options: ImportCadastrosOptions
): Promise<ImportCadastrosResult> {
  let parsed: { headers: string[]; rows: ImportCell[][] };
  try {
    parsed = await parseImportFile(file);
  } catch (error) {
    return { tone: "error", message: error instanceof Error ? error.message : "Arquivo inválido." };
  }

  if (!parsed.headers.length) {
    return { tone: "error", message: "Arquivo de importação vazio ou inválido." };
  }

  const { payload, skippedRows, invalidPhoneRows } = buildImportPayload(parsed.headers, parsed.rows);

  if (!payload.length) {
    return {
      tone: "error",
      message: "Nenhuma linha válida para importar. Verifique nome, contato, data e culto."
    };
  }

  const { errorMessage } = await submitImportPayload(client, payload, options);
  if (errorMessage) {
    return { tone: "error", message: errorMessage };
  }

  const notes = [];
  if (skippedRows.length) notes.push(`linhas ignoradas: ${skippedRows.slice(0, 8).join(", ")}`);
  if (invalidPhoneRows.length) notes.push(`contatos inválidos: ${invalidPhoneRows.slice(0, 8).join(", ")}`);

  return {
    tone: "success",
    message: notes.length
      ? `Importação concluída com avisos: ${notes.join(" | ")}.`
      : "Importação concluída com sucesso."
  };
}
