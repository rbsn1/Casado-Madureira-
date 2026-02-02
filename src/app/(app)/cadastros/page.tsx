"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { downloadCsv, parseCsv } from "@/lib/csv";
import * as XLSX from "xlsx";

type PessoaItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  igreja_origem?: string | null;
  bairro?: string | null;
  created_at: string;
  status?: string;
  responsavel_id?: string | null;
  updated_at?: string | null;
};

function CadastrosContent() {
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [pessoas, setPessoas] = useState<PessoaItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [showCreate, setShowCreate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [igrejaSelecionada, setIgrejaSelecionada] = useState("Sede");
  const [igrejaOutra, setIgrejaOutra] = useState("");
  const [showIgreja, setShowIgreja] = useState(true);
  const [showBairro, setShowBairro] = useState(true);
  const searchParams = useSearchParams();

  const igrejaOptions = ["Sede", "Congregação Cidade Nova", "Congregação Japiim", "Congregação Alvorada", "Outra"];

  const loadPessoas = useCallback(async () => {
    if (!supabaseClient) {
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

    let pessoasQuery = supabaseClient
      .from("pessoas")
      .select("id, nome_completo, telefone_whatsapp, origem, igreja_origem, bairro, created_at")
      .order("created_at", { ascending: false });

    if (igrejaFiltro) {
      if (igrejaFiltro === "__null") {
        pessoasQuery = pessoasQuery.is("igreja_origem", null);
      } else {
        pessoasQuery = pessoasQuery.eq("igreja_origem", igrejaFiltro);
      }
    }
    if (bairroFiltro) {
      if (bairroFiltro === "__null") {
        pessoasQuery = pessoasQuery.is("bairro", null);
      } else {
        pessoasQuery = pessoasQuery.eq("bairro", bairroFiltro);
      }
    }
    if (origemFiltro) pessoasQuery = pessoasQuery.ilike("origem", `%${origemFiltro}%`);
    if (origemTipo) {
      if (origemTipo === "celula") {
        pessoasQuery = pessoasQuery.or("origem.ilike.%celula%,origem.ilike.%célula%");
      } else if (origemTipo === "outro") {
        // filtro adicional aplicado após o merge
      } else if (origemTipo !== "outro") {
        pessoasQuery = pessoasQuery.ilike("origem", `%${origemTipo}%`);
      }
    }
    if (mesFiltro && /^\d{4}-\d{2}$/.test(mesFiltro)) {
      const [yearStr, monthStr] = mesFiltro.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      pessoasQuery = pessoasQuery.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
    }

    const [pessoasResult, integracaoResult] = await Promise.all([
      pessoasQuery,
      supabaseClient.from("integracao_novos_convertidos").select("pessoa_id, status, updated_at, responsavel_id")
    ]);

    if (pessoasResult.error || integracaoResult.error) {
      setStatusMessage("Não foi possível carregar os cadastros.");
      setLoading(false);
      return;
    }

    const integracaoMap = new Map(
      (integracaoResult.data ?? []).map((item) => [
        item.pessoa_id,
        { status: item.status, responsavel_id: item.responsavel_id, updated_at: item.updated_at }
      ])
    );

    let merged = (pessoasResult.data ?? []).map((pessoa) => {
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
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    loadPessoas();
  }, [loadPessoas]);

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

  const columnCount = 7 + (showIgreja ? 1 : 0) + (showBairro ? 1 : 0);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;
    setStatusMessage("");
    const formData = new FormData(event.currentTarget);
    const bairro = String(formData.get("bairro") ?? "");
    if (bairro && bairro.trim().length < 2) {
      setStatusMessage("O bairro precisa ter ao menos 2 caracteres.");
      return;
    }
    if (igrejaSelecionada === "Outra" && !igrejaOutra.trim()) {
      setStatusMessage("Informe a igreja de origem.");
      return;
    }
    const igrejaOrigem = igrejaSelecionada === "Outra" ? igrejaOutra : igrejaSelecionada;
    const payload = {
      nome_completo: String(formData.get("nome_completo") ?? ""),
      telefone_whatsapp: String(formData.get("telefone_whatsapp") ?? ""),
      origem: String(formData.get("origem") ?? ""),
      igreja_origem: igrejaOrigem || null,
      bairro: bairro || null,
      data: formData.get("data") ? String(formData.get("data")) : null,
      observacoes: String(formData.get("observacoes") ?? "")
    };
    const { error } = await supabaseClient.from("pessoas").insert(payload);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    setShowCreate(false);
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
    const payload = parsed.rows.map((row) => ({
      nome_completo: row[headerIndex.nome_completo] ?? row[headerIndex.nome] ?? "",
      telefone_whatsapp: row[headerIndex.telefone_whatsapp] ?? row[headerIndex.telefone] ?? "",
      origem: row[headerIndex.origem] ?? "",
      igreja_origem: row[headerIndex.igreja_origem] ?? row[headerIndex.igreja] ?? "",
      bairro: row[headerIndex.bairro] ?? "",
      data: row[headerIndex.data] ? String(row[headerIndex.data]) : null,
      observacoes: row[headerIndex.observacoes] ?? ""
    }));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Gestão de Pessoas</p>
          <h2 className="text-xl font-semibold text-emerald-900">Cadastros</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCreate((prev) => !prev)}
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

      {showCreate ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome completo</span>
            <input
              name="nome_completo"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Telefone (WhatsApp)</span>
            <input
              name="telefone_whatsapp"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Origem</span>
            <input
              name="origem"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Data</span>
            <input
              name="data"
              type="date"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Observações</span>
            <textarea
              name="observacoes"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Salvar cadastro
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
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
                {["Nome", "Telefone", "Origem", showIgreja ? "Igreja" : null, showBairro ? "Bairro" : null, "Status", "Responsável", "Atualizado em", "Ações"]
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
                  <td className="px-4 py-3 text-slate-700">{pessoa.responsavel_id ?? "A definir"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pessoa.updated_at ? new Date(pessoa.updated_at).toLocaleDateString("pt-BR") : "-"}
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
