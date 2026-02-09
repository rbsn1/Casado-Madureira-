"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { downloadCsv, parseCsv } from "@/lib/csv";
import * as XLSX from "xlsx";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";
import { formatDateBR } from "@/lib/date";

type PessoaItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  igreja_origem?: string | null;
  bairro?: string | null;
  data?: string | null;
  observacoes?: string | null;
  created_at: string;
  status?: string;
  responsavel_id?: string | null;
  updated_at?: string | null;
  cadastro_completo_status?: "pendente" | "link_enviado" | "concluido" | null;
  cadastro_completo_at?: string | null;
};

type IntegracaoItem = {
  pessoa_id: string;
  status?: string | null;
  responsavel_id?: string | null;
  updated_at?: string | null;
};

type PessoaQueryRow = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  igreja_origem: string | null;
  bairro: string | null;
  data: string | null;
  observacoes: string | null;
  created_at: string;
  cadastro_completo_status?: "pendente" | "link_enviado" | "concluido" | null;
  cadastro_completo_at?: string | null;
};

function isMissingProfileCompletionColumnsError(message: string, code?: string) {
  return (
    code === "PGRST204" ||
    message.includes("cadastro_completo_status") ||
    message.includes("cadastro_completo_at")
  );
}

function CadastrosContent() {
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [pessoas, setPessoas] = useState<PessoaItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<PessoaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [bairro, setBairro] = useState("");
  const [data, setData] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [igrejaSelecionada, setIgrejaSelecionada] = useState("Sede");
  const [igrejaOutra, setIgrejaOutra] = useState("");
  const [showIgreja, setShowIgreja] = useState(true);
  const [showBairro, setShowBairro] = useState(true);
  const [lastConfirmedAt, setLastConfirmedAt] = useState<Date | null>(null);
  const [generatingLinkForId, setGeneratingLinkForId] = useState<string | null>(null);
  const [canGenerateCompletionLink, setCanGenerateCompletionLink] = useState(false);
  const searchParams = useSearchParams();

  const igrejaOptions = ["Sede", "Congregação Cidade Nova", "Congregação Japiim", "Congregação Alvorada", "Outra"];

  const loadPessoas = useCallback(async () => {
    const client = supabaseClient;
    if (!client) {
      setStatusMessage("Supabase não configurado.");
      return;
    }
    setLoading(true);
    setStatusMessage("");
    const igrejaFiltro = searchParams.get("igreja_origem");
    const bairroFiltro = searchParams.get("bairro");
    const origemFiltro = searchParams.get("origem");
    const origemTipo = searchParams.get("origem_tipo");
    const mesFiltro = searchParams.get("mes");

    const buildPessoasQuery = (columns: string) => {
      let query = client.from("pessoas").select(columns).order("created_at", { ascending: false });

      if (igrejaFiltro) {
        if (igrejaFiltro === "__null") {
          query = query.is("igreja_origem", null);
        } else {
          query = query.eq("igreja_origem", igrejaFiltro);
        }
      }
      if (bairroFiltro) {
        if (bairroFiltro === "__null") {
          query = query.is("bairro", null);
        } else {
          query = query.eq("bairro", bairroFiltro);
        }
      }
      if (origemFiltro) query = query.ilike("origem", `%${origemFiltro}%`);
      if (origemTipo) {
        if (origemTipo === "celula") {
          query = query.or("origem.ilike.%celula%,origem.ilike.%célula%");
        } else if (origemTipo === "outro") {
          // filtro adicional aplicado após o merge
        } else if (origemTipo !== "outro") {
          query = query.ilike("origem", `%${origemTipo}%`);
        }
      }
      if (mesFiltro && /^\d{4}-\d{2}$/.test(mesFiltro)) {
        const [yearStr, monthStr] = mesFiltro.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      return query;
    };

    const baseColumns =
      "id, nome_completo, telefone_whatsapp, origem, igreja_origem, bairro, data, observacoes, created_at";
    let pessoasResult = await buildPessoasQuery(`${baseColumns}, cadastro_completo_status, cadastro_completo_at`);
    let usingLegacyColumns = false;

    if (
      pessoasResult.error &&
      isMissingProfileCompletionColumnsError(pessoasResult.error.message, pessoasResult.error.code)
    ) {
      usingLegacyColumns = true;
      pessoasResult = await buildPessoasQuery(baseColumns);
    }

    if (pessoasResult.error) {
      setStatusMessage(`Não foi possível carregar os cadastros. ${pessoasResult.error.message}`);
      setLoading(false);
      return;
    }

    const pessoasRows = (pessoasResult.data ?? []) as PessoaQueryRow[];
    const pessoasData: PessoaItem[] = pessoasRows.map((item) => ({
      id: item.id,
      nome_completo: item.nome_completo,
      telefone_whatsapp: item.telefone_whatsapp,
      origem: item.origem,
      igreja_origem: item.igreja_origem,
      bairro: item.bairro,
      data: item.data,
      observacoes: item.observacoes,
      created_at: item.created_at,
      cadastro_completo_status: usingLegacyColumns ? null : item.cadastro_completo_status ?? null,
      cadastro_completo_at: usingLegacyColumns ? null : item.cadastro_completo_at ?? null
    }));

    const pessoaIds = (pessoasData ?? []).map((item) => item.id);
    let integracaoRows: IntegracaoItem[] = [];
    let integracaoWarning = "";

    if (pessoaIds.length) {
      const loadIntegracao = (columns: string) =>
        client
          .from("integracao_novos_convertidos")
          .select(columns)
          .in("pessoa_id", pessoaIds);

      let integracaoResult = await loadIntegracao("pessoa_id, status, updated_at, responsavel_id");
      if (integracaoResult.error) {
        // Fallback para ambientes legados que não possuem todas as colunas da integração.
        integracaoResult = await loadIntegracao("pessoa_id, status, updated_at");
      }
      if (integracaoResult.error) {
        integracaoResult = await loadIntegracao("pessoa_id, status");
      }

      if (integracaoResult.error) {
        integracaoWarning = "Cadastros carregados sem dados de integração.";
      } else {
        integracaoRows = (integracaoResult.data ?? []) as IntegracaoItem[];
      }
    }

    const integracaoMap = new Map(
      integracaoRows.map((item) => [
        item.pessoa_id,
        { status: item.status, responsavel_id: item.responsavel_id, updated_at: item.updated_at }
      ])
    );

    let merged = (pessoasData ?? []).map((pessoa) => {
      const integracao = integracaoMap.get(pessoa.id);
      return {
        ...pessoa,
        status: integracao?.status ?? "PENDENTE",
        responsavel_id: integracao?.responsavel_id ?? null,
        updated_at: integracao?.updated_at ?? null
      };
    });

    const statusQuery = searchParams.get("status");
    if (statusQuery) {
      merged = merged.filter((item) => item.status === statusQuery);
      setStatusFilter(statusQuery);
    }

    if (origemTipo === "outro") {
      merged = merged.filter((item) => {
        const origem = (item.origem ?? "").toLowerCase();
        return !(
          origem.includes("manh") ||
          origem.includes("noite") ||
          origem.includes("evento") ||
          origem.includes("celula") ||
          origem.includes("célula")
        );
      });
    }

    setPessoas(merged);
    if (integracaoWarning) {
      setStatusMessage(integracaoWarning);
    }
    setLoading(false);
  }, [searchParams]);

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
      const matchesSearch =
        !term ||
        pessoa.nome_completo.toLowerCase().includes(term) ||
        (pessoa.telefone_whatsapp ?? "").toLowerCase().includes(term) ||
        (pessoa.origem ?? "").toLowerCase().includes(term) ||
        (pessoa.igreja_origem ?? "").toLowerCase().includes(term) ||
        (pessoa.bairro ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "TODOS" || pessoa.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pessoas, search, statusFilter]);

  function getTodayKey() {
    const now = new Date();
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
  }

  const todayCount = useMemo(() => {
    const todayKey = getTodayKey();
    return pessoas.filter((pessoa) => {
      if (!pessoa.created_at) return false;
      const key = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Manaus",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(pessoa.created_at));
      return key === todayKey;
    }).length;
  }, [pessoas]);

  const columnCount = 8 + (showIgreja ? 1 : 0) + (showBairro ? 1 : 0);

  function getCadastroCompletoLabel(status?: PessoaItem["cadastro_completo_status"]) {
    if (status === "concluido") return "Concluído";
    if (status === "link_enviado") return "Link enviado";
    return "Pendente";
  }

  function getCadastroCompletoClass(status?: PessoaItem["cadastro_completo_status"]) {
    if (status === "concluido") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "link_enviado") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  function resetForm() {
    setNome("");
    setTelefone("");
    setOrigem("");
    setIgrejaSelecionada("Sede");
    setIgrejaOutra("");
    setBairro("");
    setData("");
    setObservacoes("");
  }

  function openCreate() {
    setEditingPessoa(null);
    resetForm();
    setShowCreate(true);
  }

  function openEdit(pessoa: PessoaItem) {
    setEditingPessoa(pessoa);
    setNome(pessoa.nome_completo ?? "");
    setTelefone(formatBrazilPhoneInput(pessoa.telefone_whatsapp ?? ""));
    setOrigem(pessoa.origem ?? "");
    const igrejaAtual = pessoa.igreja_origem ?? "Sede";
    if (igrejaOptions.includes(igrejaAtual)) {
      setIgrejaSelecionada(igrejaAtual);
      setIgrejaOutra("");
    } else {
      setIgrejaSelecionada("Outra");
      setIgrejaOutra(igrejaAtual);
    }
    setBairro(pessoa.bairro ?? "");
    setData(pessoa.data ?? "");
    setObservacoes(pessoa.observacoes ?? "");
    setShowCreate(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;
    setStatusMessage("");
    const bairroInput = bairro;
    const telefoneRaw = telefone;
    const telefoneParsed = parseBrazilPhone(telefoneRaw);
    if (bairroInput && bairroInput.trim().length < 2) {
      setStatusMessage("O bairro precisa ter ao menos 2 caracteres.");
      return;
    }
    if (!telefoneParsed) {
      setStatusMessage("Informe o telefone com DDD. Ex: (92) 99227-0057.");
      return;
    }
    if (igrejaSelecionada === "Outra" && !igrejaOutra.trim()) {
      setStatusMessage("Informe a igreja de origem.");
      return;
    }
    const igrejaOrigem = igrejaSelecionada === "Outra" ? igrejaOutra : igrejaSelecionada;
    const payload = {
      nome_completo: nome.trim(),
      telefone_whatsapp: telefoneParsed.formatted,
      origem: origem.trim(),
      igreja_origem: igrejaOrigem || null,
      bairro: bairroInput || null,
      data: data || null,
      observacoes: observacoes.trim(),
      request_id: crypto.randomUUID()
    };
    if (editingPessoa) {
      const { error } = await supabaseClient.from("pessoas").update(payload).eq("id", editingPessoa.id);
      if (error) {
        setStatusMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabaseClient.from("pessoas").insert(payload);
      if (error) {
        if (error.code === "23505") {
          setStatusMessage("Cadastro duplicado detectado e ignorado com segurança.");
          setShowCreate(false);
          setEditingPessoa(null);
          resetForm();
          await loadPessoas();
          return;
        }
        setStatusMessage(error.message);
        return;
      }
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
      pessoa.origem ?? "",
      pessoa.igreja_origem ?? "",
      pessoa.bairro ?? "",
      pessoa.status ?? "",
      pessoa.responsavel_id ?? "",
      pessoa.created_at
    ]);
    downloadCsv(
      "cadastros.csv",
      ["nome", "telefone", "origem", "igreja_origem", "bairro", "status", "responsavel_id", "criado_em"],
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
        setStatusMessage("Arquivo Excel inválido.");
        return;
      }
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];
      const rows = data
        .map((row) => row.map((cell) => String(cell ?? "").trim()))
        .filter((row) => row.some((cell) => cell.length > 0));
      parsed = { headers: rows[0] ?? [], rows: rows.slice(1) };
    } else {
      const text = await file.text();
      parsed = parseCsv(text);
    }
    if (!parsed.headers.length) {
      setStatusMessage("Arquivo de importação vazio ou inválido.");
      return;
    }
    const headerIndex = parsed.headers.reduce<Record<string, number>>((acc, header, index) => {
      acc[header.toLowerCase()] = index;
      return acc;
    }, {});
    const invalidRows: number[] = [];
    const payload = parsed.rows.map((row, index) => {
      const telefoneRaw = row[headerIndex.telefone_whatsapp] ?? row[headerIndex.telefone] ?? "";
      const telefoneParsed = parseBrazilPhone(String(telefoneRaw));
      if (!telefoneParsed) invalidRows.push(index + 2);
      return {
        nome_completo: row[headerIndex.nome_completo] ?? row[headerIndex.nome] ?? "",
        telefone_whatsapp: telefoneParsed?.formatted ?? "",
        origem: row[headerIndex.origem] ?? "",
        igreja_origem: row[headerIndex.igreja_origem] ?? row[headerIndex.igreja] ?? "",
        bairro: row[headerIndex.bairro] ?? "",
        data: row[headerIndex.data] ? String(row[headerIndex.data]) : null,
        observacoes: row[headerIndex.observacoes] ?? "",
        request_id: crypto.randomUUID()
      };
    });
    if (invalidRows.length) {
      setStatusMessage(
        `Telefone sem DDD ou inválido nas linhas: ${invalidRows.slice(0, 8).join(", ")}.`
      );
      return;
    }
    const { error } = await supabaseClient.from("pessoas").insert(payload);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadPessoas();
  }

  async function handleDelete(pessoa: PessoaItem) {
    if (!supabaseClient) return;
    const confirmed = window.confirm(
      `Excluir o cadastro de "${pessoa.nome_completo}"? Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;
    setStatusMessage("");
    setDeletingId(pessoa.id);
    const { error: integracaoError } = await supabaseClient
      .from("integracao_novos_convertidos")
      .delete()
      .eq("pessoa_id", pessoa.id);
    if (integracaoError) {
      setStatusMessage(integracaoError.message);
      setDeletingId(null);
      return;
    }
    const { error } = await supabaseClient.from("pessoas").delete().eq("id", pessoa.id);
    if (error) {
      setStatusMessage(error.message);
      setDeletingId(null);
      return;
    }
    await loadPessoas();
    setDeletingId(null);
  }

  async function handleGenerateCompletionLink(pessoa: PessoaItem) {
    if (!supabaseClient) return;
    setStatusMessage("");
    setGeneratingLinkForId(pessoa.id);

    const { data, error } = await supabaseClient.rpc("generate_member_completion_token", {
      target_member_id: pessoa.id,
      ttl_hours: 168
    });

    if (error || !data) {
      setStatusMessage(error?.message ?? "Não foi possível gerar o link de cadastro completo.");
      setGeneratingLinkForId(null);
      return;
    }

    const token = String(data);
    const link = `${window.location.origin}/cadastro/completar?token=${encodeURIComponent(token)}`;

    try {
      await navigator.clipboard.writeText(link);
      setStatusMessage(`Link copiado para ${pessoa.nome_completo}. Envie para o membro concluir o cadastro.`);
    } catch {
      window.prompt("Copie o link de cadastro completo:", link);
      setStatusMessage(`Link gerado para ${pessoa.nome_completo}.`);
    }

    await loadPessoas();
    setGeneratingLinkForId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Gestão de Pessoas</p>
          <h2 className="text-xl font-semibold text-emerald-900">Cadastros</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Novo cadastro
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Importar CSV/XLSX
          </button>
          <Link
            href="/cadastros_import_modelo.xlsx"
            className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Baixar modelo
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

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Cadastros feitos hoje
          </p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900">{todayCount}</p>
          {lastConfirmedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Confirmado às{" "}
              {lastConfirmedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setLastConfirmedAt(new Date())}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Confirmar
        </button>
      </div>

      {showCreate ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome completo</span>
            <input
              name="nome_completo"
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Telefone (WhatsApp)</span>
            <input
              name="telefone_whatsapp"
              required
              value={telefone}
              onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="(92) 99227-0057"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Origem</span>
            <input
              name="origem"
              value={origem}
              onChange={(event) => setOrigem(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Igreja de origem / Congregação</span>
            <select
              name="igreja_origem"
              value={igrejaSelecionada}
              onChange={(event) => setIgrejaSelecionada(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              {igrejaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {igrejaSelecionada === "Outra" ? (
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Qual igreja?</span>
              <input
                name="igreja_origem_outra"
                value={igrejaOutra}
                onChange={(event) => setIgrejaOutra(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Bairro</span>
            <input
              name="bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Data</span>
            <input
              name="data"
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Observações</span>
            <textarea
              name="observacoes"
              rows={2}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {editingPessoa ? "Salvar alterações" : "Salvar cadastro"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setEditingPessoa(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar por nome, telefone ou origem"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none md:w-80"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            <option value="TODOS">Todos os status</option>
            <option>PENDENTE</option>
            <option>EM_ANDAMENTO</option>
            <option>CONTATO</option>
            <option>INTEGRADO</option>
            <option>BATIZADO</option>
          </select>
          <button
            onClick={loadPessoas}
            className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900"
          >
            Atualizar
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showIgreja}
              onChange={(event) => setShowIgreja(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Igreja
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showBairro}
              onChange={(event) => setShowBairro(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Bairro
          </label>
        </div>

        {statusMessage ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Nome",
                  "Telefone",
                  "Origem",
                  showIgreja ? "Igreja" : null,
                  showBairro ? "Bairro" : null,
                  "Status",
                  "Cadastro completo",
                  "Responsável",
                  "Atualizado em",
                  "Ações"
                ]
                  .filter(Boolean)
                  .map((col) => (
                    <th key={col as string} className="px-4 py-2 text-left font-semibold text-slate-600">
                      {col}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando cadastros...
                  </td>
                </tr>
              ) : null}
              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-500">
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
                  <td className="px-4 py-3 text-slate-700">{pessoa.telefone_whatsapp}</td>
                  <td className="px-4 py-3 text-slate-700">{pessoa.origem}</td>
                  {showIgreja ? (
                    <td className="px-4 py-3 text-slate-700">{pessoa.igreja_origem ?? "-"}</td>
                  ) : null}
                  {showBairro ? (
                    <td className="px-4 py-3 text-slate-700">{pessoa.bairro ?? "-"}</td>
                  ) : null}
                  <td className="px-4 py-3">
                    <StatusBadge value={pessoa.status ?? "PENDENTE"} />
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
                  <td className="px-4 py-3 text-slate-700">{pessoa.responsavel_id ?? "A definir"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pessoa.updated_at ? formatDateBR(pessoa.updated_at) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/pessoas/${pessoa.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Timeline
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(pessoa)}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                      {canGenerateCompletionLink ? (
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
                            ? "Cadastro concluído"
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
