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
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
  { key: "NAO_INFORMADO", label: "Não informado" }
];

type TurmaStatusValue = "em_discipulado" | "pausado" | "concluido";

const TURMA_STATUS_OPTIONS: Array<{ value: TurmaStatusValue; label: string }> = [
  { value: "em_discipulado", label: "Iniciada" },
  { value: "pausado", label: "Pausada" },
  { value: "concluido", label: "Finalizada" }
];

type ModuleLookup = Record<string, string>;

function statusLabel(value: DiscipleshipCaseSummaryItem["status"]) {
  if (value === "pendente_matricula") return "INICIADA";
  if (value === "em_discipulado") return "INICIADA";
  if (value === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

function turnoLabel(key: TurnoOrigem) {
  return TURNOS.find((item) => item.key === key)?.label ?? "Não informado";
}

function toTurmaStatusValue(value: DiscipleshipCaseSummaryItem["status"]): TurmaStatusValue {
  if (value === "pausado") return "pausado";
  if (value === "concluido") return "concluido";
  return "em_discipulado";
}

function CaseCard({
  item,
  moduleNameById,
  savingStatusCaseId,
  onSaveTurmaStatus
}: {
  item: DiscipleshipCaseSummaryItem;
  moduleNameById: ModuleLookup;
  savingStatusCaseId: string | null;
  onSaveTurmaStatus: (caseId: string, status: TurmaStatusValue) => Promise<void>;
}) {
  const isSavingStatus = savingStatusCaseId === item.case_id;
  const caseTurno = turnoLabel(normalizeTurnoOrigem(item.turno_origem));
  const caseStatus = statusLabel(item.status);
  const [turmaStatus, setTurmaStatus] = useState<TurmaStatusValue>(toTurmaStatusValue(item.status));
  const moduloAtual = item.modulo_atual_id
    ? (moduleNameById[item.modulo_atual_id] ?? `#${item.modulo_atual_id.slice(0, 8)}`)
    : "Sem módulo";

  useEffect(() => {
    setTurmaStatus(toTurmaStatusValue(item.status));
  }, [item.case_id, item.status]);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{item.member_name}</p>
      <p className="mt-1 text-xs text-slate-600">{item.member_phone ?? "-"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge value={item.criticality} />
        <StatusBadge value={caseStatus} />
        <span className="text-xs text-slate-600">{criticalityLabel(item.criticality)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-700">
        Dias para confra: <strong>{item.days_to_confra ?? "-"}</strong> • Negativos: <strong>{item.negative_contact_count}</strong>
      </p>
      <p className="text-xs text-slate-700">
        Turno: <strong>{caseTurno}</strong> • Módulo: <strong>{moduloAtual}</strong>
      </p>
      <p className="mt-1 text-xs text-slate-700">
        Responsável: <strong>{item.discipulador_email ?? "A definir"}</strong>
      </p>

      <div className="mt-3 grid gap-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Status da turma</span>
          <select
            value={turmaStatus}
            onChange={(event) => setTurmaStatus(event.target.value as TurmaStatusValue)}
            disabled={isSavingStatus}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {TURMA_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            void onSaveTurmaStatus(item.case_id, turmaStatus);
          }}
          disabled={isSavingStatus}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isSavingStatus ? "Salvando status..." : "Salvar status"}
        </button>
      </div>
    </article>
  );
}

export default function DiscipuladoBoardPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [mobileTurno, setMobileTurno] = useState<TurnoOrigem>("MANHA");
  const [savingStatusCaseId, setSavingStatusCaseId] = useState<string | null>(null);
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

      const discipuladoCases = (data ?? []).filter((item) => {
        if (item.fase === "DISCIPULADO") return true;
        if (item.fase === "POS_DISCIPULADO") return false;
        return item.status === "em_discipulado" || item.status === "pausado" || item.status === "concluido";
      });
      setCases(discipuladoCases);

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
          const label = String(moduleItem.title ?? "Módulo");
          nextMap[id] = label;
        }
        setModuleNameById(nextMap);
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const orderedCases = useMemo(() => sortCases(cases), [cases]);
  const byTurno = useMemo(() => groupByTurno(orderedCases), [orderedCases]);

  async function handleSaveTurmaStatus(caseId: string, status: TurmaStatusValue) {
    if (!supabaseClient || savingStatusCaseId) return;

    setSavingStatusCaseId(caseId);
    setStatusMessage("");

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({
        status,
        fase: "DISCIPULADO"
      })
      .eq("id", caseId);

    if (error) {
      setStatusMessage(error.message);
      setSavingStatusCaseId(null);
      return;
    }

    setCases((prev) =>
      prev.map((item) =>
        item.case_id === caseId
          ? {
              ...item,
              status,
              fase: "DISCIPULADO"
            }
          : item
      )
    );

    setSavingStatusCaseId(null);
  }

  if (!hasAccess) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Em Discipulado</h2>
        <p className="mt-1 text-xs text-slate-600">Painel focado na gestão do status da turma por case.</p>
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
                      savingStatusCaseId={savingStatusCaseId}
                      onSaveTurmaStatus={handleSaveTurmaStatus}
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
                          savingStatusCaseId={savingStatusCaseId}
                          onSaveTurmaStatus={handleSaveTurmaStatus}
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
