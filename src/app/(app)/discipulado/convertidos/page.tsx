"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useActiveConfraternizacao } from "@/hooks/useActiveConfraternizacao";
import { formatDateBR } from "@/lib/date";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import {
  DiscipleshipCaseSummaryItem as CaseSummaryItem,
  loadDiscipleshipCaseSummariesWithFallback
} from "@/lib/discipleshipCases";
import { criticalityLabel } from "@/lib/discipleshipCriticality";

type CcmMemberWithoutCase = {
  member_id: string;
  member_name: string;
  member_phone: string | null;
  created_at: string | null;
  has_active_case: boolean;
};

function isMissingMembersListFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("list_ccm_members_for_discipleship");
}

function statusLabel(status: CaseSummaryItem["status"]) {
  if (status === "pendente_matricula") return "PENDENTE";
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

function confraternizacaoHeading(
  confraternizacao: { data_evento: string; status: "ativa" | "futura" | "encerrada" } | null
) {
  if (!confraternizacao) return "Sem confraternização ativa";
  const prefix = confraternizacao.status === "ativa" ? "Ativa" : "Próxima";
  return `${prefix}: ${formatDateBR(confraternizacao.data_evento)}`;
}

export default function DiscipuladoConvertidosPage() {
  const {
    confraternizacao: activeConfraternizacao,
    errorMessage: activeConfraternizacaoErrorMessage
  } = useActiveConfraternizacao();
  const [cases, setCases] = useState<CaseSummaryItem[]>([]);
  const [ccmMembers, setCcmMembers] = useState<CcmMemberWithoutCase[]>([]);
  const [visibleCcmMembersCount, setVisibleCcmMembersCount] = useState(0);
  const [withoutCaseTotalCount, setWithoutCaseTotalCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [canOpenCaseDetails, setCanOpenCaseDetails] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
  const [canDeleteCadastrosAndCases, setCanDeleteCadastrosAndCases] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [updatingConfraternizacaoCaseId, setUpdatingConfraternizacaoCaseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabaseClient) {
        if (active) setStatusMessage("Supabase não configurado.");
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;
      const allowed =
        scope.roles.includes("ADMIN_DISCIPULADO") ||
        scope.roles.includes("DISCIPULADOR") ||
        scope.roles.includes("SM_DISCIPULADO") ||
        scope.roles.includes("SECRETARIA_DISCIPULADO");
      const canOpenDetails = scope.roles.includes("DISCIPULADOR") || scope.roles.includes("ADMIN_DISCIPULADO");
      setHasAccess(allowed);
      setCanOpenCaseDetails(canOpenDetails);
      setCanCreateNovoConvertido(
        scope.roles.includes("ADMIN_DISCIPULADO") ||
          scope.roles.includes("DISCIPULADOR") ||
          scope.roles.includes("SM_DISCIPULADO") ||
          scope.roles.includes("SECRETARIA_DISCIPULADO")
      );
      setCanDeleteCadastrosAndCases(allowed);
      if (!allowed) return;

      const { data: caseSummaries, errorMessage, hasCriticalityColumns } =
        await loadDiscipleshipCaseSummariesWithFallback({
          includeExtraFields: true
        });
      if (!active) return;
      if (errorMessage) {
        setStatusMessage(errorMessage);
        return;
      }
      if (!hasCriticalityColumns) {
        setStatusMessage(
          "Criticidade indisponível neste ambiente. Aplique a migração 0025_discipulado_criticidade_contatos_confra.sql."
        );
      }
      const safeCases = (caseSummaries ?? []) as CaseSummaryItem[];
      setCases(safeCases);

      const batchSize = 500;
      const collectedMembers: CcmMemberWithoutCase[] = [];
      let offset = 0;
      let listError: { message: string; code?: string } | null = null;

      while (true) {
        const { data: listData, error } = await supabaseClient.rpc("list_ccm_members_for_discipleship", {
          search_text: null,
          rows_limit: batchSize,
          rows_offset: offset
        });
        if (error) {
          listError = error;
          break;
        }
        const rows = Array.isArray(listData) ? listData : [];
        const normalizedRows = rows
          .map((row) => {
            const item = row as Partial<CcmMemberWithoutCase>;
            if (!item.member_id || !item.member_name) return null;
            return {
              member_id: String(item.member_id),
              member_name: String(item.member_name),
              member_phone: item.member_phone ?? null,
              created_at: item.created_at ?? null,
              has_active_case: Boolean(item.has_active_case)
            } as CcmMemberWithoutCase;
          })
          .filter((item): item is CcmMemberWithoutCase => item !== null);

        collectedMembers.push(...normalizedRows);
        if (normalizedRows.length < batchSize) break;
        offset += batchSize;
      }

      if (!active) return;
      if (!listError) {
        setCcmMembers(collectedMembers);
        setVisibleCcmMembersCount(collectedMembers.length);
        setWithoutCaseTotalCount(collectedMembers.filter((item) => !item.has_active_case).length);
        return;
      }

      if (!isMissingMembersListFunctionError(listError.message, listError.code)) {
        setStatusMessage((prev) => prev || listError.message);
        setCcmMembers([]);
        setVisibleCcmMembersCount(0);
        setWithoutCaseTotalCount(0);
        return;
      }

      const ccmRows: Array<{
        id: string;
        nome_completo: string;
        telefone_whatsapp: string | null;
        created_at: string | null;
      }> = [];
      let from = 0;

      while (true) {
        const to = from + batchSize - 1;
        const { data: peopleData, error: peopleError } = await supabaseClient
          .from("pessoas")
          .select("id, nome_completo, telefone_whatsapp, created_at")
          .eq("cadastro_origem", "ccm")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (peopleError) {
          if (!active) return;
          setStatusMessage((prev) => prev || peopleError.message);
          setCcmMembers([]);
          setVisibleCcmMembersCount(0);
          setWithoutCaseTotalCount(0);
          return;
        }

        const batch = Array.isArray(peopleData)
          ? (peopleData as Array<{
              id: string;
              nome_completo: string;
              telefone_whatsapp: string | null;
              created_at: string | null;
            }>)
          : [];
        ccmRows.push(...batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }

      if (!active) return;
      const activeCaseMemberIds = new Set(
        safeCases
          .filter(
            (item) =>
              item.status === "pendente_matricula" ||
              item.status === "em_discipulado" ||
              item.status === "pausado"
          )
          .map((item) => item.member_id)
      );
      const mappedMembers = ccmRows
        .map((row) => {
          return {
            member_id: String(row.id),
            member_name: String(row.nome_completo),
            member_phone: row.telefone_whatsapp ?? null,
            created_at: row.created_at ?? null,
            has_active_case: activeCaseMemberIds.has(row.id)
          } as CcmMemberWithoutCase;
        })
        .filter((item): item is CcmMemberWithoutCase => item !== null);

      setCcmMembers(mappedMembers);
      setVisibleCcmMembersCount(mappedMembers.length);
      setWithoutCaseTotalCount(mappedMembers.filter((item) => !item.has_active_case).length);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeConfraternizacaoErrorMessage) return;
    setStatusMessage((prev) => prev || activeConfraternizacaoErrorMessage);
  }, [activeConfraternizacaoErrorMessage]);

  const filteredCases = useMemo(() => {
    if (statusFilter === "todos") return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [cases, statusFilter]);

  async function handleDeleteCase(item: CaseSummaryItem) {
    if (!supabaseClient || !canDeleteCadastrosAndCases) return;
    const confirmed = window.confirm(
      `Excluir o case de "${item.member_name || "membro"}"? Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    setStatusMessage("");
    setDeletingCaseId(item.case_id);
    const { error } = await supabaseClient.from("discipleship_cases").delete().eq("id", item.case_id);
    if (error) {
      const message = String(error.message ?? "");
      if (message === "not allowed") {
        setStatusMessage(
          "Sem permissão para excluir case neste ambiente. Aplique a migration de reconciliação de permissões do discipulado."
        );
      } else {
        setStatusMessage(message || "Não foi possível excluir o case.");
      }
      setDeletingCaseId(null);
      return;
    }

    setCases((prev) => prev.filter((caseItem) => caseItem.case_id !== item.case_id));
    setCcmMembers((prev) => {
      const next = prev.map((member) =>
        member.member_id === item.member_id ? { ...member, has_active_case: false } : member
      );
      setWithoutCaseTotalCount(next.filter((member) => !member.has_active_case).length);
      return next;
    });
    setDeletingCaseId(null);
  }

  async function handleToggleConfraternizacaoConfirmation(item: CaseSummaryItem) {
    if (!supabaseClient || updatingConfraternizacaoCaseId) return;
    if (!activeConfraternizacao && !item.confraternizacao_confirmada) return;

    const nextConfirmed = !item.confraternizacao_confirmada;
    const nowIso = new Date().toISOString();
    const confraternizacaoId = nextConfirmed
      ? activeConfraternizacao?.id ?? item.confraternizacao_id ?? null
      : item.confraternizacao_id ?? activeConfraternizacao?.id ?? null;

    setStatusMessage("");
    setUpdatingConfraternizacaoCaseId(item.case_id);
    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({
        confraternizacao_id: confraternizacaoId,
        confraternizacao_confirmada: nextConfirmed,
        confraternizacao_confirmada_em: nextConfirmed ? nowIso : null
      })
      .eq("id", item.case_id);

    if (error) {
      setStatusMessage(error.message || "Não foi possível salvar a confirmação da confraternização.");
      setUpdatingConfraternizacaoCaseId(null);
      return;
    }

    setCases((prev) =>
      prev.map((caseItem) =>
        caseItem.case_id === item.case_id
          ? {
              ...caseItem,
              confraternizacao_id: confraternizacaoId,
              confraternizacao_confirmada: nextConfirmed,
              confraternizacao_confirmada_em: nextConfirmed ? nowIso : null
            }
          : caseItem
      )
    );
    setUpdatingConfraternizacaoCaseId(null);
  }

  async function handleDeleteCadastro(member: CcmMemberWithoutCase) {
    if (!supabaseClient || !canDeleteCadastrosAndCases) return;
    if (member.has_active_case) {
      setStatusMessage("Este cadastro possui case ativo. Exclua o case antes de excluir o cadastro.");
      return;
    }
    const confirmed = window.confirm(
      `Excluir o cadastro de "${member.member_name}"? Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    setStatusMessage("");
    setDeletingMemberId(member.member_id);
    const { error } = await supabaseClient.from("pessoas").delete().eq("id", member.member_id);
    if (error) {
      const message = String(error.message ?? "");
      if (message === "not allowed") {
        setStatusMessage(
          "Sem permissão para excluir cadastro neste ambiente. Aplique a migration de reconciliação de permissões do discipulado."
        );
      } else {
        setStatusMessage(message || "Não foi possível excluir o cadastro.");
      }
      setDeletingMemberId(null);
      return;
    }

    setCcmMembers((prev) => {
      const next = prev.filter((item) => item.member_id !== member.member_id);
      setVisibleCcmMembersCount(next.length);
      setWithoutCaseTotalCount(next.filter((item) => !item.has_active_case).length);
      return next;
    });
    setDeletingMemberId(null);
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito aos perfis do Discipulado.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-xl font-semibold text-sky-950">Vidas Acolhidas em acompanhamento</h2>
          <p className="mt-1 text-xs text-slate-600">
            CCM visíveis: {visibleCcmMembersCount} • sem case: {withoutCaseTotalCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">{confraternizacaoHeading(activeConfraternizacao)}</p>
        </div>
        <div className="-mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="flex min-w-max items-center gap-2">
            <div className="inline-flex min-h-11 rounded-full border border-sky-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("todos")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === "todos" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pendente_matricula")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === "pendente_matricula" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Pendente
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("em_discipulado")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === "em_discipulado" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Em discipulado
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pausado")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === "pausado" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Pausado
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("concluido")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === "concluido" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Concluído
              </button>
            </div>
            {canCreateNovoConvertido ? (
              <Link
                href="/discipulado/convertidos/novo"
                className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
              >
                Nova vida acolhida
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!filteredCases.length ? (
          <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum caso encontrado.</div>
        ) : null}
        {filteredCases.map((item) => {
          const percent = item.total_modules ? Math.round((item.done_modules / item.total_modules) * 100) : 0;
          const isConfraternizacaoLoading = updatingConfraternizacaoCaseId === item.case_id;
          const canConfirmConfraternizacao = Boolean(activeConfraternizacao);
          return (
            <article key={item.case_id} className="discipulado-panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.member_name || "Membro"}</p>
                  <p className="text-xs text-slate-600">{item.member_phone ?? "-"}</p>
                </div>
                <StatusBadge value={statusLabel(item.status)} />
              </div>
              <div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Progresso: {item.done_modules}/{item.total_modules} ({percent}%)
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Urgência: {criticalityLabel(item.criticality)} • negativos: {item.negative_contact_count} • faltam{" "}
                  {item.days_to_confra ?? "-"} dias
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Discipulador: <strong>{item.discipulador_email ?? "A definir"}</strong>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Confraternização</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      item.confraternizacao_confirmada
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.confraternizacao_confirmada ? "Confirmado" : "Não confirmado"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700">{confraternizacaoHeading(activeConfraternizacao)}</p>
                <button
                  type="button"
                  onClick={() => {
                    void handleToggleConfraternizacaoConfirmation(item);
                  }}
                  disabled={!canConfirmConfraternizacao || isConfraternizacaoLoading}
                  className={`mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    item.confraternizacao_confirmada
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-sky-300 bg-white text-sky-800 hover:bg-sky-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  aria-pressed={item.confraternizacao_confirmada}
                >
                  {isConfraternizacaoLoading
                    ? "Salvando..."
                    : item.confraternizacao_confirmada
                      ? "Confirmado"
                      : "Confirmar presença"}
                </button>
              </div>
              <p className="text-xs text-slate-600">{item.notes || "Sem observações gerais."}</p>
              <div className="flex flex-wrap items-center gap-2">
                {canOpenCaseDetails ? (
                  <Link
                    href={`/discipulado/convertidos/${item.case_id}`}
                    className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-50"
                  >
                    Abrir case
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500">Detalhe restrito ao discipulador/admin.</span>
                )}
                {canDeleteCadastrosAndCases ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCase(item)}
                    disabled={deletingCaseId === item.case_id}
                    className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deletingCaseId === item.case_id ? "Excluindo..." : "Excluir case"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-sky-900">Cadastros do CCM disponíveis para o Discipulado</h3>
          {canCreateNovoConvertido ? (
            <Link
              href="/discipulado/convertidos/novo"
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-50"
            >
              Iniciar novo case
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!ccmMembers.length ? (
            <div className="discipulado-panel p-4 text-sm text-slate-600">
              Nenhum membro do CCM está visível para este usuário. Verifique o perfil e a congregação vinculada.
            </div>
          ) : null}
          {ccmMembers.map((item) => (
            <article key={item.member_id} className="discipulado-panel space-y-2 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.member_name}</p>
                <p className="text-xs text-slate-600">{item.member_phone ?? "-"}</p>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge value={item.has_active_case ? "EM_DISCIPULADO" : "PENDENTE"} />
                <div className="flex items-center gap-2">
                  {canCreateNovoConvertido && !item.has_active_case ? (
                    <Link
                      href={`/discipulado/convertidos/novo?memberId=${encodeURIComponent(item.member_id)}`}
                      className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-50"
                    >
                      Abrir case
                    </Link>
                  ) : (
                    <p className="text-xs text-slate-500">{item.has_active_case ? "Case ativo" : "Sem case ativo"}</p>
                  )}
                  {canDeleteCadastrosAndCases ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteCadastro(item)}
                      disabled={deletingMemberId === item.member_id || item.has_active_case}
                      className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingMemberId === item.member_id ? "Excluindo..." : "Excluir cadastro"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
