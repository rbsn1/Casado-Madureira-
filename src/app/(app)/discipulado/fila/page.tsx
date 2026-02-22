"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAuthScope } from "@/lib/authScope";
import {
  DiscipleshipCaseSummaryItem,
  loadDiscipleshipCaseSummariesWithFallback
} from "@/lib/discipleshipCases";
import { criticalityLabel, criticalityRank } from "@/lib/discipleshipCriticality";

const PAGE_SIZE = 20;
type ViewMode = "lista" | "kanban";

function statusLabel(status: DiscipleshipCaseSummaryItem["status"]) {
  if (status === "pendente_matricula") return "PENDENTE";
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

export default function DiscipuladoFilaPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [canOpenCase, setCanOpenCase] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("ativos");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");

  useEffect(() => {
    let active = true;

    async function load() {
      const scope = await getAuthScope();
      if (!active) return;
      const allowed =
        scope.roles.includes("ADMIN_DISCIPULADO") ||
        scope.roles.includes("DISCIPULADOR") ||
        scope.roles.includes("SM_DISCIPULADO") ||
        scope.roles.includes("SECRETARIA_DISCIPULADO");
      setHasAccess(allowed);
      setCanOpenCase(scope.roles.includes("DISCIPULADOR") || scope.roles.includes("ADMIN_DISCIPULADO"));
      if (!allowed) return;

      const { data, errorMessage, hasCriticalityColumns } = await loadDiscipleshipCaseSummariesWithFallback();
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
      setCases(data);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const orderedCases = useMemo(() => {
    const base =
      statusFilter === "todos"
        ? cases
        : cases.filter(
            (item) =>
              item.status === "pendente_matricula" ||
              item.status === "em_discipulado" ||
              item.status === "pausado"
          );

    return [...base].sort((a, b) => {
      const rankDiff = criticalityRank(b.criticality) - criticalityRank(a.criticality);
      if (rankDiff !== 0) return rankDiff;

      const aDays = a.days_to_confra ?? 999999;
      const bDays = b.days_to_confra ?? 999999;
      if (aDays !== bDays) return aDays - bDays;

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [cases, statusFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, cases.length]);

  const visibleCases = useMemo(() => orderedCases.slice(0, visibleCount), [orderedCases, visibleCount]);
  const hasMoreCases = visibleCount < orderedCases.length;
  const kanbanStatuses = useMemo<DiscipleshipCaseSummaryItem["status"][]>(
    () =>
      statusFilter === "ativos"
        ? ["pendente_matricula", "em_discipulado", "pausado"]
        : ["pendente_matricula", "em_discipulado", "pausado", "concluido"],
    [statusFilter]
  );
  const kanbanColumns = useMemo(
    () =>
      kanbanStatuses.map((status) => ({
        status,
        title: statusLabel(status),
        items: visibleCases.filter((item) => item.status === status)
      })),
    [kanbanStatuses, visibleCases]
  );

  function renderCaseCard(item: DiscipleshipCaseSummaryItem) {
    const percent = item.total_modules ? Math.round((item.done_modules / item.total_modules) * 100) : 0;
    const cardContent = (
      <div className="discipulado-panel block space-y-3 p-4 transition hover:border-sky-300">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{item.member_name || "Membro"}</p>
            <p className="text-xs text-slate-600">{item.member_phone ?? "-"}</p>
          </div>
          <StatusBadge value={statusLabel(item.status)} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge value={item.criticality} />
          <p className="text-xs font-semibold text-slate-700">{criticalityLabel(item.criticality)}</p>
        </div>
        <p className="text-xs text-slate-700">
          Negativos: <strong>{item.negative_contact_count}</strong> • Faltam{" "}
          <strong>{item.days_to_confra ?? "-"}</strong> dias para a confra
        </p>
        <p className="text-xs text-slate-600">
          Discipulador: <strong>{item.discipulador_email ?? "A definir"}</strong>
        </p>
        <div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Progresso: {item.done_modules}/{item.total_modules} ({percent}%)
          </p>
        </div>
      </div>
    );

    if (!canOpenCase) {
      return <div key={item.case_id}>{cardContent}</div>;
    }

    return (
      <Link key={item.case_id} href={`/discipulado/convertidos/${item.case_id}`}>
        {cardContent}
      </Link>
    );
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
          <h2 className="text-xl font-semibold text-sky-950">Fila do acolhedor</h2>
          <p className="mt-1 text-xs text-slate-600">
            Ordenação por criticidade (CRÍTICA primeiro) e proximidade da confra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-sky-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("lista")}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                viewMode === "lista" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                viewMode === "kanban" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
              }`}
            >
              Kanban
            </button>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="ativos">Pendentes/Ativos/Pausados</option>
            <option value="todos">Todos</option>
          </select>
          <Link
            href="/discipulado/convertidos/novo"
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Novo convertido
          </Link>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      <p className="text-xs text-slate-600">
        Exibindo {Math.min(visibleCases.length, orderedCases.length)} de {orderedCases.length} casos.
      </p>

      {viewMode === "lista" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!orderedCases.length ? (
            <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum caso na fila.</div>
          ) : null}
          {visibleCases.map((item) => renderCaseCard(item))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kanbanColumns.map((column) => (
            <section key={column.status} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <StatusBadge value={statusLabel(column.status)} />
                <span className="text-xs font-semibold text-slate-600">{column.items.length}</span>
              </div>
              <div className="space-y-3">
                {column.items.length ? (
                  column.items.map((item) => renderCaseCard(item))
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    Sem casos nesta coluna.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasMoreCases ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50"
          >
            Carregar mais 20
          </button>
        </div>
      ) : null}
    </div>
  );
}
