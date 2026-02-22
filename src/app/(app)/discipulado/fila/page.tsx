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
import { supabaseClient } from "@/lib/supabaseClient";

const PAGE_SIZE = 20;
const NEAR_CONFRA_DAYS = 7;
const GROUP_MODE_STORAGE_KEY = "discipulado_fila_kanban_group_mode";

type ViewMode = "lista" | "kanban";
type KanbanGroupMode = "status" | "origin";
type OriginKey = "MANHA" | "NOITE" | "EVENTO" | "SEM_ORIGEM";

type QueueCase = DiscipleshipCaseSummaryItem & {
  origin: OriginKey;
  days_without_contact: number;
};

type KanbanStatus = DiscipleshipCaseSummaryItem["status"];

type StatusColumnModel = {
  status: KanbanStatus;
  title: string;
  items: QueueCase[];
};

type OriginSectionModel = {
  origin: OriginKey;
  title: string;
  total: number;
  criticalCount: number;
  nearConfraCount: number;
  columns: StatusColumnModel[];
};

const ORIGIN_ORDER: OriginKey[] = ["MANHA", "NOITE", "EVENTO", "SEM_ORIGEM"];

function statusLabel(status: KanbanStatus) {
  if (status === "pendente_matricula") return "PENDENTE";
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

function originLabel(origin: OriginKey) {
  if (origin === "MANHA") return "Culto da Manhã";
  if (origin === "NOITE") return "Culto da Noite";
  if (origin === "EVENTO") return "Evento";
  return "Sem origem";
}

function normalizeOrigin(value: string | null | undefined): OriginKey {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!normalized) return "SEM_ORIGEM";
  if (normalized.includes("MANH")) return "MANHA";
  if (normalized.includes("NOITE")) return "NOITE";
  if (normalized.includes("EVENT")) return "EVENTO";
  return "SEM_ORIGEM";
}

function toDaysSince(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function sortCases(items: QueueCase[]) {
  return [...items].sort((a, b) => {
    const rankDiff = criticalityRank(b.criticality) - criticalityRank(a.criticality);
    if (rankDiff !== 0) return rankDiff;

    const aDaysToConfra = a.days_to_confra ?? 999999;
    const bDaysToConfra = b.days_to_confra ?? 999999;
    if (aDaysToConfra !== bDaysToConfra) return aDaysToConfra - bDaysToConfra;

    const negativesDiff = b.negative_contact_count - a.negative_contact_count;
    if (negativesDiff !== 0) return negativesDiff;

    const noContactDiff = b.days_without_contact - a.days_without_contact;
    if (noContactDiff !== 0) return noContactDiff;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function groupByStatus(items: QueueCase[], statuses: KanbanStatus[]): StatusColumnModel[] {
  return statuses.map((status) => ({
    status,
    title: statusLabel(status),
    items: sortCases(items.filter((item) => item.status === status))
  }));
}

function groupByOrigin(items: QueueCase[], statuses: KanbanStatus[]): OriginSectionModel[] {
  return ORIGIN_ORDER.map((origin) => {
    const originItems = sortCases(items.filter((item) => item.origin === origin));
    const criticalCount = originItems.filter((item) => item.criticality === "CRITICA").length;
    const nearConfraCount = originItems.filter(
      (item) => item.days_to_confra !== null && item.days_to_confra >= 0 && item.days_to_confra <= NEAR_CONFRA_DAYS
    ).length;

    return {
      origin,
      title: originLabel(origin),
      total: originItems.length,
      criticalCount,
      nearConfraCount,
      columns: groupByStatus(originItems, statuses)
    };
  }).filter((section) => section.total > 0);
}

function CaseCard({ item, canOpenCase }: { item: QueueCase; canOpenCase: boolean }) {
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
        Negativos: <strong>{item.negative_contact_count}</strong> • Faltam <strong>{item.days_to_confra ?? "-"}</strong> dias para a confra
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

function StatusColumn({ column, canOpenCase }: { column: StatusColumnModel; canOpenCase: boolean }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge value={column.title} />
        <span className="text-xs font-semibold text-slate-600">{column.items.length}</span>
      </div>
      <div className="space-y-3">
        {column.items.length ? (
          column.items.map((item) => <CaseCard key={item.case_id} item={item} canOpenCase={canOpenCase} />)
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Sem casos nesta coluna.</p>
        )}
      </div>
    </section>
  );
}

function OriginSection({ section, canOpenCase }: { section: OriginSectionModel; canOpenCase: boolean }) {
  return (
    <section className="discipulado-panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <h3 className="text-sm font-semibold text-sky-900">{section.title}</h3>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Total: {section.total}</span>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Críticos: {section.criticalCount}</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          Próx. confra ≤{NEAR_CONFRA_DAYS}d: {section.nearConfraCount}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {section.columns.map((column) => (
          <StatusColumn key={`${section.origin}-${column.status}`} column={column} canOpenCase={canOpenCase} />
        ))}
      </div>
    </section>
  );
}

function KanbanByOrigin({ sections, canOpenCase }: { sections: OriginSectionModel[]; canOpenCase: boolean }) {
  if (!sections.length) {
    return <div className="discipulado-panel p-4 text-sm text-slate-600">Sem casos nesta origem.</div>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <OriginSection key={section.origin} section={section} canOpenCase={canOpenCase} />
      ))}
    </div>
  );
}

export default function DiscipuladoFilaPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [canOpenCase, setCanOpenCase] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [memberOriginById, setMemberOriginById] = useState<Record<string, string | null>>({});
  const [statusFilter, setStatusFilter] = useState("ativos");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [kanbanGroupMode, setKanbanGroupMode] = useState<KanbanGroupMode>("origin");

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

      if (supabaseClient && data.length) {
        const memberIds = [...new Set(data.map((item) => item.member_id))];
        const { data: membersData, error: membersError } = await supabaseClient
          .from("pessoas")
          .select("id, origem")
          .in("id", memberIds);

        if (!active) return;
        if (!membersError && membersData) {
          const nextMap: Record<string, string | null> = {};
          for (const member of membersData as Array<{ id: string; origem: string | null }>) {
            nextMap[String(member.id)] = member.origem ?? null;
          }
          setMemberOriginById(nextMap);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(GROUP_MODE_STORAGE_KEY);
    if (stored === "status" || stored === "origin") {
      setKanbanGroupMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(GROUP_MODE_STORAGE_KEY, kanbanGroupMode);
  }, [kanbanGroupMode]);

  const orderedCases = useMemo<QueueCase[]>(() => {
    const base =
      statusFilter === "todos"
        ? cases
        : cases.filter(
            (item) =>
              item.status === "pendente_matricula" ||
              item.status === "em_discipulado" ||
              item.status === "pausado"
          );

    const normalized = base.map((item) => ({
      ...item,
      origin: normalizeOrigin(memberOriginById[item.member_id]),
      days_without_contact: toDaysSince(item.updated_at)
    }));

    return sortCases(normalized);
  }, [cases, memberOriginById, statusFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, cases.length]);

  const visibleCases = useMemo(() => orderedCases.slice(0, visibleCount), [orderedCases, visibleCount]);
  const hasMoreCases = visibleCount < orderedCases.length;

  const kanbanStatuses = useMemo<KanbanStatus[]>(
    () =>
      statusFilter === "ativos"
        ? ["pendente_matricula", "em_discipulado", "pausado"]
        : ["pendente_matricula", "em_discipulado", "pausado", "concluido"],
    [statusFilter]
  );

  const kanbanColumns = useMemo(() => groupByStatus(visibleCases, kanbanStatuses), [visibleCases, kanbanStatuses]);
  const kanbanOriginSections = useMemo(() => groupByOrigin(visibleCases, kanbanStatuses), [visibleCases, kanbanStatuses]);

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
        <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => {
                  setViewMode("kanban");
                  setKanbanGroupMode("origin");
                }}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  viewMode === "kanban" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
              Kanban
            </button>
          </div>

          {viewMode === "kanban" ? (
            <div className="rounded-lg border border-sky-200 bg-white p-1">
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agrupar por:</span>
              <button
                type="button"
                onClick={() => setKanbanGroupMode("status")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  kanbanGroupMode === "status" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Status
              </button>
              <button
                type="button"
                onClick={() => setKanbanGroupMode("origin")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  kanbanGroupMode === "origin" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
              >
                Origem
              </button>
            </div>
          ) : null}

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
          {!orderedCases.length ? <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum caso na fila.</div> : null}
          {visibleCases.map((item) => (
            <CaseCard key={item.case_id} item={item} canOpenCase={canOpenCase} />
          ))}
        </div>
      ) : kanbanGroupMode === "status" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kanbanColumns.map((column) => (
            <StatusColumn key={column.status} column={column} canOpenCase={canOpenCase} />
          ))}
        </div>
      ) : (
        <KanbanByOrigin sections={kanbanOriginSections} canOpenCase={canOpenCase} />
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
