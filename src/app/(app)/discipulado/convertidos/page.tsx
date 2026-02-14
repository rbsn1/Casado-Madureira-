"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

export default function DiscipuladoConvertidosPage() {
  const [cases, setCases] = useState<CaseSummaryItem[]>([]);
  const [ccmMembers, setCcmMembers] = useState<CcmMemberWithoutCase[]>([]);
  const [visibleCcmMembersCount, setVisibleCcmMembersCount] = useState(0);
  const [withoutCaseTotalCount, setWithoutCaseTotalCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
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
      const allowed = scope.roles.includes("DISCIPULADOR");
      setHasAccess(allowed);
      setCanCreateNovoConvertido(
        scope.roles.includes("DISCIPULADOR") ||
          scope.roles.includes("SM_DISCIPULADO") ||
          scope.roles.includes("SECRETARIA_DISCIPULADO")
      );
      if (!allowed) return;

      const { data: caseSummaries, errorMessage, hasCriticalityColumns } =
        await loadDiscipleshipCaseSummariesWithFallback();
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
          .filter((item) => item.status === "em_discipulado" || item.status === "pausado")
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

  const filteredCases = useMemo(() => {
    if (statusFilter === "todos") return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [cases, statusFilter]);

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
          <h2 className="text-xl font-semibold text-sky-950">Convertidos em acompanhamento</h2>
          <p className="mt-1 text-xs text-slate-600">
            CCM visíveis: {visibleCcmMembersCount} • sem case: {withoutCaseTotalCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="em_discipulado">Em discipulado</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
          </select>
          {canCreateNovoConvertido ? (
            <Link
              href="/discipulado/convertidos/novo"
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Novo convertido
            </Link>
          ) : null}
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
          return (
            <Link
              key={item.case_id}
              href={`/discipulado/convertidos/${item.case_id}`}
              className="discipulado-panel block space-y-3 p-4 transition hover:border-sky-300"
            >
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
              <p className="text-xs text-slate-600">{item.notes || "Sem observações gerais."}</p>
            </Link>
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
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
