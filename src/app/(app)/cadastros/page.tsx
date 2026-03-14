"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { formatDateBR } from "@/lib/date";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  CULTO_ORIGEM_OPTIONS,
  CultoOrigemCode,
  cultoOrigemLabelFromValue,
  cultoOrigemToLegacyOrigem,
  parseCultoOrigemCode
} from "@/lib/cultoOrigem";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

type CadastroCompletoStatus = "pendente" | "link_enviado" | "concluido";

type PessoaItem = {
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

const fieldLabelClass = "text-slate-700";
const fieldClass =
  "block min-w-0 w-full max-w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none sm:text-base";
const primaryButtonClass =
  "w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto";
const secondaryButtonClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900 sm:w-auto";
const toolbarButtonClass = "w-full rounded-xl px-3 py-3 text-sm font-semibold sm:w-auto";
const feedbackClass = "rounded-xl px-4 py-3 text-sm";

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function isMissingColumnError(message: string, code: string | undefined, column: string) {
  return code === "PGRST204" && message.includes(column);
}

function isMissingRequestIdColumnError(message: string, code?: string) {
  return isMissingColumnError(message, code, "request_id");
}

function toTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeImportDate(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (!Number.isFinite(serial)) return null;
    const parsed = (XLSX as unknown as { SSF?: { parse_date_code?: (input: number) => { y: number; m: number; d: number } | null } })
      ?.SSF?.parse_date_code?.(serial);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${toTwoDigits(parsed.m)}-${toTwoDigits(parsed.d)}`;
    }
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

function getCadastroCompletoLabel(status: CadastroCompletoStatus | null | undefined) {
  if (status === "concluido") return "Cadastro completo";
  if (status === "link_enviado") return "Link enviado";
  return "Pendente de complementação";
}

function getCadastroCompletoClass(status: CadastroCompletoStatus | null | undefined) {
  if (status === "concluido") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "link_enviado") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function CadastrosContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success" | "info">("info");
  const [statusMessage, setStatusMessage] = useState("");
  const [pessoas, setPessoas] = useState<PessoaItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | CadastroCompletoStatus>("TODOS");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<PessoaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingLinkForId, setGeneratingLinkForId] = useState<string | null>(null);
  const [canGenerateCompletionLink, setCanGenerateCompletionLink] = useState(false);
  const [hasCompletionStatusColumn, setHasCompletionStatusColumn] = useState(true);
  const [hasCultoColumn, setHasCultoColumn] = useState(true);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataCadastro, setDataCadastro] = useState(currentLocalDateInputValue());
  const [cultoOrigem, setCultoOrigem] = useState<CultoOrigemCode>("DOMINGO_MANHA");

  const resetForm = useCallback(() => {
    setNome("");
    setTelefone("");
    setDataCadastro(currentLocalDateInputValue());
    setCultoOrigem("DOMINGO_MANHA");
  }, []);

  const loadPessoas = useCallback(async () => {
    const client = supabaseClient;
    if (!client) {
      setFeedbackTone("error");
      setStatusMessage("Supabase não configurado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatusMessage("");

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
      setFeedbackTone("error");
      setStatusMessage(`Não foi possível carregar os cadastros. ${pessoasResult.error.message}`);
      setLoading(false);
      return;
    }

    const rows = Array.isArray(pessoasResult.data) ? (pessoasResult.data as PessoaQueryRow[]) : [];
    setHasCultoColumn(!usingLegacyCulto);
    setHasCompletionStatusColumn(!usingLegacyCompletion);
    setPessoas(
      rows.map((row) => ({
        id: String(row.id),
        nome_completo: String(row.nome_completo ?? ""),
        telefone_whatsapp: row.telefone_whatsapp ?? null,
        origem: row.origem ?? null,
        culto_origem: usingLegacyCulto ? null : row.culto_origem ?? null,
        data: row.data ?? null,
        created_at: String(row.created_at ?? ""),
        cadastro_completo_status: usingLegacyCompletion ? null : row.cadastro_completo_status ?? "pendente",
        cadastro_completo_at: usingLegacyCompletion ? null : row.cadastro_completo_at ?? null
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPessoas();
  }, [loadPessoas]);

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.rpc("get_my_roles");
      if (!active) return;
      const roles = (data ?? []) as string[];
      setCanGenerateCompletionLink(
        roles.some((role) =>
          ["ADMIN_MASTER", "PASTOR", "SECRETARIA", "NOVOS_CONVERTIDOS", "CADASTRADOR"].includes(role)
        )
      );
    }

    loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pessoas.filter((pessoa) => {
      const cultoLabel = cultoOrigemLabelFromValue(pessoa.culto_origem ?? pessoa.origem).toLowerCase();
      const matchesSearch =
        !term ||
        pessoa.nome_completo.toLowerCase().includes(term) ||
        (pessoa.telefone_whatsapp ?? "").toLowerCase().includes(term) ||
        cultoLabel.includes(term);
      const matchesStatus =
        statusFilter === "TODOS" || (pessoa.cadastro_completo_status ?? "pendente") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pessoas, search, statusFilter]);

  const todayCount = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    return pessoas.filter((pessoa) => {
      if (!pessoa.created_at) return false;
      const createdKey = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Manaus",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(pessoa.created_at));
      return createdKey === todayKey;
    }).length;
  }, [pessoas]);

  function openCreate() {
    setEditingPessoa(null);
    resetForm();
    setShowCreate(true);
    setStatusMessage("");
  }

  function openEdit(pessoa: PessoaItem) {
    setEditingPessoa(pessoa);
    setNome(pessoa.nome_completo);
    setTelefone(formatBrazilPhoneInput(pessoa.telefone_whatsapp ?? ""));
    setDataCadastro(pessoa.data ?? currentLocalDateInputValue());
    setCultoOrigem(parseCultoOrigemCode(pessoa.culto_origem ?? pessoa.origem) ?? "OUTRO");
    setShowCreate(true);
    setStatusMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;

    const nomeFinal = nome.trim();
    if (nomeFinal.length < 3) {
      setFeedbackTone("error");
      setStatusMessage("Informe o nome com pelo menos 3 caracteres.");
      return;
    }

    const telefoneParsed = parseBrazilPhone(telefone);
    if (!telefoneParsed) {
      setFeedbackTone("error");
      setStatusMessage("Informe o contato com DDD. Ex: (92) 99227-0057.");
      return;
    }

    if (!dataCadastro) {
      setFeedbackTone("error");
      setStatusMessage("A data do cadastro é obrigatória.");
      return;
    }

    const cultoSelecionado = parseCultoOrigemCode(cultoOrigem);
    if (!cultoSelecionado) {
      setFeedbackTone("error");
      setStatusMessage("Selecione o culto.");
      return;
    }

    let payload: Record<string, unknown> = {
      nome_completo: nomeFinal,
      telefone_whatsapp: telefoneParsed.formatted,
      origem: cultoOrigemToLegacyOrigem(cultoSelecionado),
      data: dataCadastro
    };

    if (hasCultoColumn) {
      payload.culto_origem = cultoSelecionado;
    }

    if (!editingPessoa && hasCompletionStatusColumn) {
      payload.cadastro_completo_status = "pendente";
    }

    if (editingPessoa) {
      const { error } = await supabaseClient.from("pessoas").update(payload).eq("id", editingPessoa.id);
      if (error) {
        setFeedbackTone("error");
        setStatusMessage(error.message);
        return;
      }
      setFeedbackTone("success");
      setStatusMessage("Cadastro rápido atualizado com sucesso.");
    } else {
      payload.request_id = crypto.randomUUID();

      let { error } = await supabaseClient.from("pessoas").insert(payload);

      if (error && isMissingRequestIdColumnError(error.message, error.code)) {
        const { request_id: _requestId, ...fallbackPayload } = payload;
        payload = fallbackPayload;
        ({ error } = await supabaseClient.from("pessoas").insert(payload));
      }

      if (error) {
        if (error.code === "23505") {
          setFeedbackTone("success");
          setStatusMessage("Cadastro já recebido anteriormente. A duplicidade foi evitada.");
          setShowCreate(false);
          resetForm();
          await loadPessoas();
          return;
        }
        setFeedbackTone("error");
        setStatusMessage(error.message);
        return;
      }

      setFeedbackTone("success");
      setStatusMessage("Cadastro rápido salvo. Os dados complementares ficam pendentes para depois.");
    }

    setShowCreate(false);
    setEditingPessoa(null);
    resetForm();
    await loadPessoas();
  }

  function handleExport() {
    const rows = filtered.map((pessoa) => [
      pessoa.nome_completo,
      pessoa.telefone_whatsapp ?? "",
      pessoa.data ?? "",
      cultoOrigemLabelFromValue(pessoa.culto_origem ?? pessoa.origem),
      getCadastroCompletoLabel(pessoa.cadastro_completo_status)
    ]);

    downloadCsv(
      "cadastros-rapidos-ccm.csv",
      ["nome", "contato", "data", "culto", "status_cadastro"],
      rows
    );
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !supabaseClient) return;

    setStatusMessage("");

    const isExcel = file.name.toLowerCase().endsWith(".xlsx");
    let parsed: { headers: string[]; rows: string[][] };

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) {
        setFeedbackTone("error");
        setStatusMessage("Arquivo Excel inválido.");
        return;
      }
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];
      const rows = data
        .map((row) => row.map((cell) => String(cell ?? "").trim()))
        .filter((row) => row.some((cell) => cell.length > 0));
      parsed = { headers: rows[0] ?? [], rows: rows.slice(1) };
    } else {
      parsed = parseCsv(await file.text());
    }

    if (!parsed.headers.length) {
      setFeedbackTone("error");
      setStatusMessage("Arquivo de importação vazio ou inválido.");
      return;
    }

    const headerIndex = parsed.headers.reduce<Record<string, number>>((acc, header, index) => {
      acc[String(header).toLowerCase()] = index;
      return acc;
    }, {});

    const skippedRows: number[] = [];
    const invalidPhoneRows: number[] = [];

    const payload = parsed.rows
      .map((row, index) => {
        const line = index + 2;
        const nomeValue = String(row[headerIndex.nome_completo] ?? row[headerIndex.nome] ?? "").trim();
        const contatoValue = String(
          row[headerIndex.contato] ?? row[headerIndex.telefone_whatsapp] ?? row[headerIndex.telefone] ?? ""
        ).trim();
        const cultoValue = String(
          row[headerIndex.culto] ?? row[headerIndex.culto_origem] ?? row[headerIndex.origem] ?? row[headerIndex.turno] ?? ""
        ).trim();
        const rawDateValue = String(
          row[headerIndex.data] ?? row[headerIndex.criado_em] ?? row[headerIndex.created_at] ?? ""
        ).trim();

        if (!nomeValue || !contatoValue || !cultoValue || !rawDateValue) {
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

        const isoDate = normalizeImportDate(rawDateValue);
        if (!isoDate) {
          skippedRows.push(line);
          return null;
        }

        const item: Record<string, unknown> = {
          nome_completo: nomeValue,
          telefone_whatsapp: telefoneParsed.formatted,
          origem: cultoOrigemToLegacyOrigem(cultoParsed),
          data: isoDate,
          created_at: isoDateToManausCreatedAt(isoDate),
          updated_at: isoDateToManausCreatedAt(isoDate),
          request_id: crypto.randomUUID()
        };

        if (hasCultoColumn) {
          item.culto_origem = cultoParsed;
        }
        if (hasCompletionStatusColumn) {
          item.cadastro_completo_status = parseCadastroCompletoStatus(
            String(row[headerIndex.status_cadastro] ?? row[headerIndex.status] ?? "pendente")
          );
        }

        return item;
      })
      .filter((item): item is Record<string, unknown> => item !== null);

    if (!payload.length) {
      setFeedbackTone("error");
      setStatusMessage("Nenhuma linha válida para importar. Verifique nome, contato, data e culto.");
      return;
    }

    let { error } = await supabaseClient.from("pessoas").insert(payload);
    if (error && isMissingRequestIdColumnError(error.message, error.code)) {
      const fallbackPayload = payload.map(({ request_id: _requestId, ...rest }) => rest);
      ({ error } = await supabaseClient.from("pessoas").insert(fallbackPayload));
    }

    if (error) {
      setFeedbackTone("error");
      setStatusMessage(error.message);
      return;
    }

    const notes = [];
    if (skippedRows.length) notes.push(`linhas ignoradas: ${skippedRows.slice(0, 8).join(", ")}`);
    if (invalidPhoneRows.length) notes.push(`contatos inválidos: ${invalidPhoneRows.slice(0, 8).join(", ")}`);

    setFeedbackTone("success");
    setStatusMessage(
      notes.length
        ? `Importação concluída com avisos: ${notes.join(" | ")}.`
        : "Importação concluída com sucesso."
    );

    event.target.value = "";
    await loadPessoas();
  }

  async function handleDelete(pessoa: PessoaItem) {
    if (!supabaseClient) return;

    const confirmed = window.confirm(
      `Excluir o cadastro de "${pessoa.nome_completo}"? Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    setDeletingId(pessoa.id);
    setStatusMessage("");

    const { error } = await supabaseClient.from("pessoas").delete().eq("id", pessoa.id);
    if (error) {
      setFeedbackTone("error");
      setStatusMessage(error.message || "Não foi possível excluir o cadastro.");
      setDeletingId(null);
      return;
    }

    setFeedbackTone("success");
    setStatusMessage("Cadastro removido com sucesso.");
    setDeletingId(null);
    await loadPessoas();
  }

  async function handleGenerateCompletionLink(pessoa: PessoaItem) {
    if (!supabaseClient) return;

    setGeneratingLinkForId(pessoa.id);
    setStatusMessage("");

    const { data, error } = await supabaseClient.rpc("generate_member_completion_token", {
      target_member_id: pessoa.id,
      ttl_hours: 168
    });

    if (error || !data) {
      setFeedbackTone("error");
      setStatusMessage(error?.message ?? "Não foi possível gerar o link de cadastro completo.");
      setGeneratingLinkForId(null);
      return;
    }

    const token = String(data);
    const link = `${window.location.origin}/cadastro/completar?token=${encodeURIComponent(token)}`;

    try {
      await navigator.clipboard.writeText(link);
      setFeedbackTone("success");
      setStatusMessage(`Link copiado para ${pessoa.nome_completo}.`);
    } catch {
      window.prompt("Copie o link de cadastro completo:", link);
      setFeedbackTone("info");
      setStatusMessage(`Link gerado para ${pessoa.nome_completo}.`);
    }

    setGeneratingLinkForId(null);
    await loadPessoas();
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Gestão de Pessoas</p>
          <h2 className="text-xl font-semibold text-emerald-900">Cadastros rápidos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visualize o cadastro inicial resumido do perfil <strong>CADASTRADOR</strong>, com foco em nome, contato, data, culto e status de complementação.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={openCreate}
            className={`${toolbarButtonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Novo cadastro rápido (Cadastrador)
          </button>
          <button
            onClick={handleExport}
            className={`${toolbarButtonClass} border border-emerald-300 text-emerald-900 hover:bg-emerald-50`}
          >
            Exportar CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${toolbarButtonClass} border border-dashed border-emerald-300 text-emerald-900 hover:bg-emerald-50`}
          >
            Importar CSV/XLSX
          </button>
          <Link
            href="/cadastros_import_modelo.csv"
            className={`${toolbarButtonClass} block text-center border border-emerald-200 text-emerald-900 hover:bg-emerald-50`}
          >
            Baixar modelo CSV
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cadastros feitos hoje</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900">{todayCount}</p>
          <p className="mt-1 text-xs text-slate-500">Fluxo pensado para operação rápida em culto.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 sm:max-w-md">
          O formulário resumido é do perfil <strong>CADASTRADOR</strong> e cada novo registro entra como <strong>pendente de complementação</strong>.
        </div>
      </div>

      {showCreate ? (
        <form className="card grid gap-4 p-4 md:grid-cols-2" onSubmit={handleSubmit}>
          {!hasCultoColumn ? (
            <p className={`${feedbackClass} border border-amber-200 bg-amber-50 text-amber-700 md:col-span-2`}>
              A coluna `culto_origem` ainda não existe neste ambiente. Aplique a migração `0067_ccm_culto_rapido.sql`.
            </p>
          ) : null}
          {!hasCompletionStatusColumn ? (
            <p className={`${feedbackClass} border border-amber-200 bg-amber-50 text-amber-700 md:col-span-2`}>
              O status de complementação ainda não existe neste ambiente. Aplique a migração `0020_member_profile_completion.sql`.
            </p>
          ) : null}

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={fieldLabelClass}>Nome</span>
            <input
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={fieldClass}
              placeholder="Digite o nome da pessoa"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>Contato</span>
            <input
              required
              value={telefone}
              onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
              className={fieldClass}
              placeholder="(92) 99227-0057"
            />
          </label>

          <label className="min-w-0 space-y-1 text-sm">
            <span className={fieldLabelClass}>Data</span>
            <input
              required
              type="date"
              value={dataCadastro}
              onChange={(event) => setDataCadastro(event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={fieldLabelClass}>Culto</span>
            <select
              value={cultoOrigem}
              onChange={(event) => {
                const parsed = parseCultoOrigemCode(event.target.value);
                if (parsed) setCultoOrigem(parsed);
              }}
              className={fieldClass}
            >
              {CULTO_ORIGEM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:col-span-2">
            Este cadastro resumido é o fluxo do perfil <strong>CADASTRADOR</strong>. Os demais dados serão preenchidos posteriormente pela equipe ou pelo link de complementação.
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button className={primaryButtonClass}>
              {editingPessoa ? "Salvar alterações" : "Salvar rápido"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setEditingPessoa(null);
                resetForm();
              }}
              className={secondaryButtonClass}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="card p-4">
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <input
            type="search"
            placeholder="Buscar por nome, contato ou culto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${fieldClass} sm:max-w-sm`}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "TODOS" | CadastroCompletoStatus)}
            className={`${fieldClass} sm:w-auto`}
          >
            <option value="TODOS">Todos os status</option>
            <option value="pendente">Pendente de complementação</option>
            <option value="link_enviado">Link enviado</option>
            <option value="concluido">Cadastro completo</option>
          </select>
          <button
            onClick={loadPessoas}
            className={`${toolbarButtonClass} bg-emerald-100 text-emerald-900`}
          >
            Atualizar
          </button>
        </div>

        {statusMessage ? (
          <p
            className={`mt-3 ${feedbackClass} ${
              feedbackTone === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : feedbackTone === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Carregando cadastros...
            </div>
          ) : null}

          {!loading && !filtered.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhum cadastro encontrado.
            </div>
          ) : null}

          {!loading
            ? filtered.map((pessoa) => (
                <article key={pessoa.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/pessoas/${pessoa.id}`} className="block text-sm font-semibold text-slate-900">
                        {pessoa.nome_completo}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{pessoa.telefone_whatsapp ?? "Sem contato"}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getCadastroCompletoClass(
                        pessoa.cadastro_completo_status
                      )}`}
                    >
                      {getCadastroCompletoLabel(pessoa.cadastro_completo_status)}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Data</dt>
                      <dd className="font-medium text-slate-800">{pessoa.data ? formatDateBR(pessoa.data) : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Culto</dt>
                      <dd className="font-medium text-slate-800">{cultoOrigemLabelFromValue(pessoa.culto_origem ?? pessoa.origem)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/pessoas/${pessoa.id}`}
                      className="rounded-xl bg-emerald-600 px-3 py-3 text-center text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Abrir
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(pessoa)}
                      className="rounded-xl border border-emerald-200 px-3 py-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Editar
                    </button>
                    {canGenerateCompletionLink && hasCompletionStatusColumn ? (
                      <button
                        type="button"
                        onClick={() => handleGenerateCompletionLink(pessoa)}
                        disabled={
                          generatingLinkForId === pessoa.id ||
                          pessoa.cadastro_completo_status === "concluido"
                        }
                        className="rounded-xl border border-sky-200 px-3 py-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {pessoa.cadastro_completo_status === "concluido"
                          ? "Cadastro completo"
                          : generatingLinkForId === pessoa.id
                            ? "Gerando link..."
                            : "Gerar link completo"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(pessoa)}
                      disabled={deletingId === pessoa.id}
                      className="rounded-xl border border-rose-200 px-3 py-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))
            : null}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "Contato", "Data", "Culto", "Status do cadastro", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando cadastros...
                  </td>
                </tr>
              ) : null}

              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum cadastro encontrado.
                  </td>
                </tr>
              ) : null}

              {filtered.map((pessoa) => (
                <tr key={pessoa.id} className="hover:bg-emerald-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <Link href={`/pessoas/${pessoa.id}`} className="hover:underline">
                      {pessoa.nome_completo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.telefone_whatsapp ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pessoa.data ? formatDateBR(pessoa.data) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {cultoOrigemLabelFromValue(pessoa.culto_origem ?? pessoa.origem)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getCadastroCompletoClass(
                        pessoa.cadastro_completo_status
                      )}`}
                    >
                      {getCadastroCompletoLabel(pessoa.cadastro_completo_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/pessoas/${pessoa.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Abrir
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(pessoa)}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                      {canGenerateCompletionLink && hasCompletionStatusColumn ? (
                        <button
                          type="button"
                          onClick={() => handleGenerateCompletionLink(pessoa)}
                          disabled={
                            generatingLinkForId === pessoa.id ||
                            pessoa.cadastro_completo_status === "concluido"
                          }
                          className="rounded-lg border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {pessoa.cadastro_completo_status === "concluido"
                            ? "Completo"
                            : generatingLinkForId === pessoa.id
                              ? "Gerando..."
                              : "Link completo"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(pessoa)}
                        disabled={deletingId === pessoa.id}
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CadastrosPage() {
  return (
    <Suspense fallback={<div className="card p-4 text-sm text-slate-500">Carregando...</div>}>
      <CadastrosContent />
    </Suspense>
  );
}
