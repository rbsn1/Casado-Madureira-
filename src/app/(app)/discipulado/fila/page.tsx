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

type AssigneeOption = {
  id: string;
  label: string;
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
  if (normalized.includes("QUARTA")) return "NOITE";
  if (normalized.includes("NOITE")) return "NOITE";
  if (normalized.includes("MJ")) return "EVENTO";
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

function CaseCard({
  item,
  canOpenCase,
  assigneeOptions,
  onAssignResponsible,
  assigningCaseId
}: {
  item: QueueCase;
  canOpenCase: boolean;
  assigneeOptions: AssigneeOption[];
  onAssignResponsible: (caseId: string, assignedTo: string | null) => Promise<void>;
  assigningCaseId: string | null;
}) {
  const percent = item.total_modules ? Math.round((item.done_modules / item.total_modules) * 100) : 0;
  const isAssigning = assigningCaseId === item.case_id;

  return (
    <article className="discipulado-panel block space-y-3 p-4 transition hover:border-sky-300">
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
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Acolhedor responsável</span>
        <select
          value={item.assigned_to ?? ""}
          onChange={(event) => {
            const selected = event.target.value.trim();
            void onAssignResponsible(item.case_id, selected || null);
          }}
          disabled={isAssigning}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">A definir</option>
          {assigneeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Progresso: {item.done_modules}/{item.total_modules} ({percent}%)
        </p>
      </div>
      {canOpenCase ? (
        <Link
          href={`/discipulado/convertidos/${item.case_id}`}
          className="inline-flex items-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
        >
          Abrir case
        </Link>
      ) : null}
    </article>
  );
}

function StatusColumn({
  column,
  canOpenCase,
  assigneeOptions,
  onAssignResponsible,
  assigningCaseId
}: {
  column: StatusColumnModel;
  canOpenCase: boolean;
  assigneeOptions: AssigneeOption[];
  onAssignResponsible: (caseId: string, assignedTo: string | null) => Promise<void>;
  assigningCaseId: string | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge value={column.title} />
        <span className="text-xs font-semibold text-slate-600">{column.items.length}</span>
      </div>
      <div className="space-y-3">
        {column.items.length ? (
          column.items.map((item) => (
            <CaseCard
              key={item.case_id}
              item={item}
              canOpenCase={canOpenCase}
              assigneeOptions={assigneeOptions}
              onAssignResponsible={onAssignResponsible}
              assigningCaseId={assigningCaseId}
            />
          ))
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Sem casos nesta coluna.</p>
        )}
      </div>
    </section>
  );
}

function OriginSection({
  section,
  canOpenCase,
  assigneeOptions,
  onAssignResponsible,
  assigningCaseId
}: {
  section: OriginSectionModel;
  canOpenCase: boolean;
  assigneeOptions: AssigneeOption[];
  onAssignResponsible: (caseId: string, assignedTo: string | null) => Promise<void>;
  assigningCaseId: string | null;
}) {
  return (
    <section className="discipulado-panel p-3 sm:p-4">
      <div className="sticky top-2 z-20 -mx-3 mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/95 px-3 pb-3 pt-2 backdrop-blur-sm sm:-mx-4 sm:px-4">
        <h3 className="text-sm font-semibold text-sky-900">{section.title}</h3>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Total: {section.total}</span>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Críticos: {section.criticalCount}</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          Próx. confra ≤{NEAR_CONFRA_DAYS}d: {section.nearConfraCount}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {section.columns.map((column) => (
          <StatusColumn
            key={`${section.origin}-${column.status}`}
            column={column}
            canOpenCase={canOpenCase}
            assigneeOptions={assigneeOptions}
            onAssignResponsible={onAssignResponsible}
            assigningCaseId={assigningCaseId}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanByOrigin({
  sections,
  canOpenCase,
  assigneeOptions,
  onAssignResponsible,
  assigningCaseId
}: {
  sections: OriginSectionModel[];
  canOpenCase: boolean;
  assigneeOptions: AssigneeOption[];
  onAssignResponsible: (caseId: string, assignedTo: string | null) => Promise<void>;
  assigningCaseId: string | null;
}) {
  if (!sections.length) {
    return <div className="discipulado-panel p-4 text-sm text-slate-600">Sem casos nesta origem.</div>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <OriginSection
          key={section.origin}
          section={section}
          canOpenCase={canOpenCase}
          assigneeOptions={assigneeOptions}
          onAssignResponsible={onAssignResponsible}
          assigningCaseId={assigningCaseId}
        />
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
  const [assigningCaseId, setAssigningCaseId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null }>({
    id: "",
    email: null
  });

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
      const { data: authData } = await supabaseClient.auth.getUser();
      if (!active) return;
      if (authData.user?.id) {
        setCurrentUser({
          id: authData.user.id,
          email: authData.user.email ?? null
        });
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
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();

    if (currentUser.id) {
      const currentLabel = currentUser.email ?? "Você";
      map.set(currentUser.id, currentLabel);
    }

    for (const item of cases) {
      if (!item.assigned_to) continue;
      if (map.has(item.assigned_to)) continue;
      map.set(item.assigned_to, item.discipulador_email ?? `ID ${item.assigned_to.slice(0, 8)}`);
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => {
        if (currentUser.id && a.id === currentUser.id) return -1;
        if (currentUser.id && b.id === currentUser.id) return 1;
        return a.label.localeCompare(b.label, "pt-BR");
      });
  }, [cases, currentUser.email, currentUser.id]);

  async function handleAssignResponsible(caseId: string, assignedTo: string | null) {
    if (!supabaseClient || assigningCaseId) return;
    setAssigningCaseId(caseId);
    setStatusMessage("");

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({ assigned_to: assignedTo })
      .eq("id", caseId);

    if (error) {
      setStatusMessage(error.message);
      setAssigningCaseId(null);
      return;
    }

    setCases((prev) =>
      prev.map((item) => {
        if (item.case_id !== caseId) return item;
        const assigneeLabel = assignedTo
          ? assigneeOptions.find((option) => option.id === assignedTo)?.label ?? item.discipulador_email
          : null;
        return {
          ...item,
          assigned_to: assignedTo,
          discipulador_email: assigneeLabel
        };
      })
    );
    setAssigningCaseId(null);
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
            <CaseCard
              key={item.case_id}
              item={item}
              canOpenCase={canOpenCase}
              assigneeOptions={assigneeOptions}
              onAssignResponsible={handleAssignResponsible}
              assigningCaseId={assigningCaseId}
            />
          ))}
        </div>
      ) : kanbanGroupMode === "status" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kanbanColumns.map((column) => (
            <StatusColumn
              key={column.status}
              column={column}
              canOpenCase={canOpenCase}
              assigneeOptions={assigneeOptions}
              onAssignResponsible={handleAssignResponsible}
              assigningCaseId={assigningCaseId}
            />
          ))}
        </div>
      ) : (
        <KanbanByOrigin
          sections={kanbanOriginSections}
          canOpenCase={canOpenCase}
          assigneeOptions={assigneeOptions}
          onAssignResponsible={handleAssignResponsible}
          assigningCaseId={assigningCaseId}
        />
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
