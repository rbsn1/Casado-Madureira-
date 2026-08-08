"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { formatDateBR } from "@/lib/date";
import { supabaseClient } from "@/lib/supabaseClient";
import { cultoOrigemLabelFromValue } from "@/lib/cultoOrigem";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import { importCadastrosFile } from "@/lib/cadastrosImport";
import {
  CadastroCompletoStatus,
  PessoaItem,
  deletePessoa,
  generateCompletionLink,
  getCadastroCompletoClass,
  getCadastroCompletoLabel,
  loadPessoas as loadPessoasFromApi
} from "@/lib/cadastrosApi";
import { CadastroForm } from "@/components/cadastros/CadastroForm";

const toolbarButtonClass = "w-full rounded-xl px-3 py-3 text-sm font-semibold sm:w-auto";
const feedbackClass = "rounded-xl px-4 py-3 text-sm";
const fieldClass =
  "block min-w-0 w-full max-w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none sm:text-base";

function CadastrosContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isCadastradorOnly, canManageCadastrosDirectly, canGenerateCompletionLink } = useCadastrosPermissions();

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
  const [hasCompletionStatusColumn, setHasCompletionStatusColumn] = useState(true);
  const [hasCultoColumn, setHasCultoColumn] = useState(true);

  const reloadPessoas = useCallback(async () => {
    if (!supabaseClient) {
      setFeedbackTone("error");
      setStatusMessage("Supabase não configurado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatusMessage("");

    const result = await loadPessoasFromApi(supabaseClient);
    setHasCultoColumn(result.hasCultoColumn);
    setHasCompletionStatusColumn(result.hasCompletionStatusColumn);

    if (result.errorMessage) {
      setFeedbackTone("error");
      setStatusMessage(result.errorMessage);
      setLoading(false);
      return;
    }

    setPessoas(result.pessoas);
    setLoading(false);
  }, []);

  useEffect(() => {
    reloadPessoas();
  }, [reloadPessoas]);

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
    setShowCreate(true);
    setStatusMessage("");
  }

  function openEdit(pessoa: PessoaItem) {
    setEditingPessoa(pessoa);
    setShowCreate(true);
    setStatusMessage("");
  }

  function closeForm() {
    setShowCreate(false);
    setEditingPessoa(null);
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

    const result = await importCadastrosFile(supabaseClient, file, {
      canManageCadastrosDirectly,
      hasCultoColumn,
      hasCompletionStatusColumn
    });

    setFeedbackTone(result.tone);
    setStatusMessage(result.message);

    event.target.value = "";

    if (result.tone === "success") {
      await reloadPessoas();
    }
  }

  async function handleDelete(pessoa: PessoaItem) {
    if (!supabaseClient) return;

    const confirmed = window.confirm(
      `Excluir o cadastro de "${pessoa.nome_completo}"? Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    setDeletingId(pessoa.id);
    setStatusMessage("");

    const { errorMessage } = await deletePessoa(supabaseClient, pessoa.id);
    if (errorMessage) {
      setFeedbackTone("error");
      setStatusMessage(errorMessage);
      setDeletingId(null);
      return;
    }

    setFeedbackTone("success");
    setStatusMessage("Cadastro removido com sucesso.");
    setDeletingId(null);
    await reloadPessoas();
  }

  async function handleGenerateCompletionLink(pessoa: PessoaItem) {
    if (!supabaseClient) return;

    setGeneratingLinkForId(pessoa.id);
    setStatusMessage("");

    const { link, errorMessage } = await generateCompletionLink(supabaseClient, pessoa.id, window.location.origin);

    if (errorMessage || !link) {
      setFeedbackTone("error");
      setStatusMessage(errorMessage ?? "Não foi possível gerar o link de cadastro completo.");
      setGeneratingLinkForId(null);
      return;
    }

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
    await reloadPessoas();
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-text-muted">Gestão de Pessoas</p>
          <h2 className="text-xl font-semibold text-brand-900">
            {isCadastradorOnly ? "Cadastros rápidos" : "Cadastros"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {isCadastradorOnly ? (
              <>
                Visualize o cadastro inicial resumido do perfil <strong>CADASTRADOR</strong>, com foco em nome,
                contato, data, culto e status de complementação.
              </>
            ) : (
              <>
                Perfis administrativos usam o formulário completo. O fluxo reduzido fica restrito ao perfil{" "}
                <strong>CADASTRADOR</strong> para posterior complementação.
              </>
            )}
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={openCreate}
            className={`${toolbarButtonClass} bg-brand-600 text-white hover:bg-brand-700`}
          >
            {isCadastradorOnly ? "Novo cadastro rápido (Cadastrador)" : "Novo cadastro completo"}
          </button>
          <button
            onClick={handleExport}
            className={`${toolbarButtonClass} border border-brand-300 text-brand-900 hover:bg-brand-50`}
          >
            Exportar CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${toolbarButtonClass} border border-dashed border-brand-300 text-brand-900 hover:bg-brand-50`}
          >
            Importar CSV/XLSX
          </button>
          <Link
            href="/cadastros_import_modelo.csv"
            className={`${toolbarButtonClass} block text-center border border-brand-200 text-brand-900 hover:bg-brand-50`}
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
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Cadastros feitos hoje</p>
          <p className="mt-1 text-3xl font-semibold text-brand-900">{todayCount}</p>
          <p className="mt-1 text-xs text-text-muted">
            {isCadastradorOnly
              ? "Fluxo pensado para operação rápida em culto."
              : "Perfis administrativos usam o formulário completo no CCM."}
          </p>
        </div>
        <div className="rounded-xl border border-warning-100 bg-warning-100 px-4 py-3 text-sm leading-6 text-warning-600 sm:max-w-md">
          {isCadastradorOnly ? (
            <>
              O formulário resumido é do perfil <strong>CADASTRADOR</strong> e cada novo registro entra como{" "}
              <strong>pendente de complementação</strong>.
            </>
          ) : (
            <>
              Perfis administrativos usam o <strong>formulário completo</strong>. O fluxo reduzido fica reservado ao{" "}
              <strong>CADASTRADOR</strong> para complementação posterior.
            </>
          )}
        </div>
      </div>

      {showCreate ? (
        <CadastroForm
          key={editingPessoa?.id ?? "new"}
          editingPessoa={editingPessoa}
          isCadastradorOnly={isCadastradorOnly}
          canManageCadastrosDirectly={canManageCadastrosDirectly}
          hasCultoColumn={hasCultoColumn}
          hasCompletionStatusColumn={hasCompletionStatusColumn}
          onCancel={closeForm}
          onResult={async (result) => {
            setFeedbackTone(result.tone);
            setStatusMessage(result.message);
            if (result.shouldClose) {
              closeForm();
              await reloadPessoas();
            }
          }}
        />
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
            onClick={reloadPessoas}
            className={`${toolbarButtonClass} bg-brand-100 text-brand-900`}
          >
            Atualizar
          </button>
        </div>

        {statusMessage ? (
          <p
            className={`mt-3 ${feedbackClass} ${
              feedbackTone === "error"
                ? "border border-danger-100 bg-danger-100 text-danger-600"
                : feedbackTone === "success"
                  ? "border border-brand-200 bg-brand-50 text-brand-700"
                  : "border border-border bg-surface text-text"
            }`}
          >
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
              Carregando cadastros...
            </div>
          ) : null}

          {!loading && !filtered.length ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
              Nenhum cadastro encontrado.
            </div>
          ) : null}

          {!loading
            ? filtered.map((pessoa) => (
                <article key={pessoa.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/pessoas/${pessoa.id}`} className="block text-sm font-semibold text-text">
                        {pessoa.nome_completo}
                      </Link>
                      <p className="mt-1 text-xs text-text-muted">{pessoa.telefone_whatsapp ?? "Sem contato"}</p>
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
                      <dt className="text-xs text-text-muted">Data</dt>
                      <dd className="font-medium text-text">{pessoa.data ? formatDateBR(pessoa.data) : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Culto</dt>
                      <dd className="font-medium text-text">{cultoOrigemLabelFromValue(pessoa.culto_origem ?? pessoa.origem)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/pessoas/${pessoa.id}`}
                      className="rounded-xl bg-brand-600 px-3 py-3 text-center text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Abrir
                    </Link>
                    {canManageCadastrosDirectly ? (
                      <button
                        type="button"
                        onClick={() => openEdit(pessoa)}
                        className="rounded-xl border border-brand-200 px-3 py-3 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        Editar
                      </button>
                    ) : null}
                    {canGenerateCompletionLink && hasCompletionStatusColumn ? (
                      <button
                        type="button"
                        onClick={() => handleGenerateCompletionLink(pessoa)}
                        disabled={
                          generatingLinkForId === pessoa.id ||
                          pessoa.cadastro_completo_status === "concluido"
                        }
                        className="rounded-xl border border-info-100 px-3 py-3 text-xs font-semibold text-info-600 hover:bg-info-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {pessoa.cadastro_completo_status === "concluido"
                          ? "Cadastro completo"
                          : generatingLinkForId === pessoa.id
                            ? "Gerando link..."
                            : "Gerar link completo"}
                      </button>
                    ) : null}
                    {canManageCadastrosDirectly ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(pessoa)}
                        disabled={deletingId === pessoa.id}
                        className="rounded-xl border border-danger-100 px-3 py-3 text-xs font-semibold text-danger-600 hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Excluir
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            : null}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface">
              <tr>
                {["Nome", "Contato", "Data", "Culto", "Status do cadastro", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-text-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                    Carregando cadastros...
                  </td>
                </tr>
              ) : null}

              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                    Nenhum cadastro encontrado.
                  </td>
                </tr>
              ) : null}

              {filtered.map((pessoa) => (
                <tr key={pessoa.id} className="hover:bg-brand-50/50">
                  <td className="px-4 py-3 font-semibold text-text">
                    <Link href={`/pessoas/${pessoa.id}`} className="hover:underline">
                      {pessoa.nome_completo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text">{pessoa.telefone_whatsapp ?? "-"}</td>
                  <td className="px-4 py-3 text-text">
                    {pessoa.data ? formatDateBR(pessoa.data) : "-"}
                  </td>
                  <td className="px-4 py-3 text-text">
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
                        className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Abrir
                      </Link>
                      {canManageCadastrosDirectly ? (
                        <button
                          type="button"
                          onClick={() => openEdit(pessoa)}
                          className="rounded-lg border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          Editar
                        </button>
                      ) : null}
                      {canGenerateCompletionLink && hasCompletionStatusColumn ? (
                        <button
                          type="button"
                          onClick={() => handleGenerateCompletionLink(pessoa)}
                          disabled={
                            generatingLinkForId === pessoa.id ||
                            pessoa.cadastro_completo_status === "concluido"
                          }
                          className="rounded-lg border border-info-100 px-3 py-1 text-xs font-semibold text-info-600 hover:bg-info-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {pessoa.cadastro_completo_status === "concluido"
                            ? "Completo"
                            : generatingLinkForId === pessoa.id
                              ? "Gerando..."
                              : "Link completo"}
                        </button>
                      ) : null}
                      {canManageCadastrosDirectly ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(pessoa)}
                          disabled={deletingId === pessoa.id}
                          className="rounded-lg border border-danger-100 px-3 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Excluir
                        </button>
                      ) : null}
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
    <Suspense fallback={<div className="card p-4 text-sm text-text-muted">Carregando...</div>}>
      <CadastrosContent />
    </Suspense>
  );
}
