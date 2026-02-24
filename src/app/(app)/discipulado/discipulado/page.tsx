"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAuthScope } from "@/lib/authScope";
import { groupByTurno, normalizeTurnoOrigem, sortCases, TurnoOrigem } from "@/lib/discipuladoPanels";
import {
  DiscipleshipCaseSummaryItem,
  loadDiscipleshipCaseSummariesWithFallback
} from "@/lib/discipleshipCases";
import { criticalityLabel } from "@/lib/discipleshipCriticality";
import { supabaseClient } from "@/lib/supabaseClient";

const TURNOS: Array<{ key: TurnoOrigem; label: string }> = [
  { key: "MANHA", label: "Culto da manhã" },
  { key: "NOITE", label: "Culto da noite" },
  { key: "EVENTO", label: "Evento" },
  { key: "NAO_INFORMADO", label: "Não informado" }
];

type AssigneeOption = {
  id: string;
  label: string;
};

type ModuleLookup = Record<string, string>;

function statusLabel(value: DiscipleshipCaseSummaryItem["status"]) {
  if (value === "pendente_matricula") return "PENDENTE";
  if (value === "em_discipulado") return "EM_DISCIPULADO";
  if (value === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

function assignmentStatusLabel(assignedTo: string | null) {
  return assignedTo ? "ATRIBUIDO" : "PENDENTE";
}

function turnoLabel(key: TurnoOrigem) {
  return TURNOS.find((item) => item.key === key)?.label ?? "Não informado";
}

function CaseCard({
  item,
  moduleNameById,
  assigneeOptions,
  assigningCaseId,
  onAssignResponsible
}: {
  item: DiscipleshipCaseSummaryItem;
  moduleNameById: ModuleLookup;
  assigneeOptions: AssigneeOption[];
  assigningCaseId: string | null;
  onAssignResponsible: (caseId: string, assignedTo: string | null) => Promise<void>;
}) {
  const isAssigning = assigningCaseId === item.case_id;
  const caseTurno = turnoLabel(normalizeTurnoOrigem(item.turno_origem));
  const caseStatus = statusLabel(item.status);
  const assignmentStatus = assignmentStatusLabel(item.assigned_to);
  const moduloAtual = item.modulo_atual_id
    ? (moduleNameById[item.modulo_atual_id] ?? `#${item.modulo_atual_id.slice(0, 8)}`)
    : "Sem módulo";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{item.member_name}</p>
      <p className="mt-1 text-xs text-slate-600">{item.member_phone ?? "-"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge value={item.criticality} />
        <StatusBadge value={caseStatus} />
        <StatusBadge value={assignmentStatus} />
        <span className="text-xs text-slate-600">{criticalityLabel(item.criticality)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-700">
        Dias para confra: <strong>{item.days_to_confra ?? "-"}</strong> • Negativos: <strong>{item.negative_contact_count}</strong>
      </p>
      <p className="text-xs text-slate-700">
        Turno: <strong>{caseTurno}</strong> • Módulo: <strong>{moduloAtual}</strong>
      </p>

      <label className="mt-3 block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Acolhedor responsável</span>
        <select
          value={item.assigned_to ?? ""}
          onChange={(event) => {
            const selected = event.target.value.trim();
            void onAssignResponsible(item.case_id, selected || null);
          }}
          disabled={isAssigning}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">A definir</option>
          {assigneeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export default function DiscipuladoBoardPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [mobileTurno, setMobileTurno] = useState<TurnoOrigem>("MANHA");
  const [assigningCaseId, setAssigningCaseId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null }>({
    id: "",
    email: null
  });
  const [assigneeDirectory, setAssigneeDirectory] = useState<AssigneeOption[]>([]);
  const [moduleNameById, setModuleNameById] = useState<ModuleLookup>({});

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
      if (!allowed) {
        setLoading(false);
        return;
      }

      const { data, errorMessage } = await loadDiscipleshipCaseSummariesWithFallback();
      if (!active) return;

      if (errorMessage) {
        setStatusMessage(errorMessage);
      }

      setCases((data ?? []).filter((item) => item.fase === "DISCIPULADO"));

      if (supabaseClient) {
        const { data: modulesData } = await supabaseClient
          .from("discipleship_modules")
          .select("id, title")
          .order("sort_order", { ascending: true });
        if (!active) return;
        const nextMap: ModuleLookup = {};
        for (const moduleItem of modulesData ?? []) {
          const id = String(moduleItem.id ?? "");
          if (!id) continue;
          nextMap[id] = String(moduleItem.title ?? "Módulo");
        }
        setModuleNameById(nextMap);
      }

      if (supabaseClient) {
        const { data: authData } = await supabaseClient.auth.getUser();
        if (!active) return;
        if (authData.user?.id) {
          setCurrentUser({
            id: authData.user.id,
            email: authData.user.email ?? null
          });
        }

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const response = await fetch("/api/discipulado/assignees", {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (response.ok) {
            const payload = (await response.json()) as {
              assignees?: Array<{ id: string; label: string }>;
            };
            const assignees = Array.isArray(payload.assignees)
              ? payload.assignees
                  .filter((item) => item?.id)
                  .map((item) => ({
                    id: String(item.id),
                    label: String(item.label ?? "")
                  }))
              : [];
            if (!active) return;
            setAssigneeDirectory(assignees);
          }
        }
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();

    for (const option of assigneeDirectory) {
      map.set(option.id, option.label || `ID ${option.id.slice(0, 8)}`);
    }

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
  }, [assigneeDirectory, cases, currentUser.email, currentUser.id]);

  const orderedCases = useMemo(() => sortCases(cases), [cases]);
  const byTurno = useMemo(() => groupByTurno(orderedCases), [orderedCases]);

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
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Em Discipulado</h2>
        <p className="mt-1 text-xs text-slate-600">Painel focado na atribuição de responsável por case.</p>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      {loading ? <div className="discipulado-panel p-4 text-sm text-slate-600">Carregando painel...</div> : null}

      {!loading ? (
        <>
          <div className="-mx-1 overflow-x-auto px-1 pb-1 md:hidden">
            <div className="flex min-w-max items-center gap-2">
              {TURNOS.map((turno) => (
                <button
                  key={turno.key}
                  type="button"
                  onClick={() => setMobileTurno(turno.key)}
                  className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    mobileTurno === turno.key
                      ? "border-sky-700 bg-sky-700 text-white"
                      : "border-sky-200 bg-white text-sky-900 hover:bg-sky-50"
                  }`}
                >
                  {turno.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            <section className="discipulado-panel p-4">
              <h3 className="text-sm font-semibold text-sky-900">{turnoLabel(mobileTurno)}</h3>
              <div className="mt-3 space-y-2">
                {!(byTurno[mobileTurno] ?? []).length ? (
                  <p className="text-xs text-slate-500">Sem cases neste turno.</p>
                ) : (
                  (byTurno[mobileTurno] ?? []).map((item) => (
                    <CaseCard
                      key={item.case_id}
                      item={item}
                      moduleNameById={moduleNameById}
                      assigneeOptions={assigneeOptions}
                      assigningCaseId={assigningCaseId}
                      onAssignResponsible={handleAssignResponsible}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="hidden space-y-4 md:block">
            {TURNOS.map((turno) => {
              const turnoCases = byTurno[turno.key] ?? [];

              return (
                <section key={turno.key} className="discipulado-panel p-4">
                  <h3 className="text-sm font-semibold text-sky-900">{turno.label}</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {!turnoCases.length ? (
                      <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                        Sem cases neste turno.
                      </p>
                    ) : (
                      turnoCases.map((item) => (
                        <CaseCard
                          key={item.case_id}
                          item={item}
                          moduleNameById={moduleNameById}
                          assigneeOptions={assigneeOptions}
                          assigningCaseId={assigningCaseId}
                          onAssignResponsible={handleAssignResponsible}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
