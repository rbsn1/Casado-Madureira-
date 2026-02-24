"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAuthScope } from "@/lib/authScope";
import { normalizeTurnoOrigem, sortCases, TurnoOrigem } from "@/lib/discipuladoPanels";
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
const TURNO_ORDER: TurnoOrigem[] = ["MANHA", "TARDE", "NOITE", "NAO_INFORMADO"];

type TurmaStatusValue = "em_discipulado" | "pausado" | "concluido";
type TurmaPlanningDraft = {
  moduleId: string;
  startDate: string;
};
type TurmaPlanningByTurno = Record<TurnoOrigem, TurmaPlanningDraft>;
type ModuleOption = {
  id: string;
  title: string;
};

const TURMA_STATUS_OPTIONS: Array<{ value: TurmaStatusValue; label: string }> = [
  { value: "em_discipulado", label: "Iniciada" },
  { value: "pausado", label: "Pausada" },
  { value: "concluido", label: "Finalizada" }
];

type ModuleLookup = Record<string, string>;
type CaseTurnosByCaseId = Record<string, TurnoOrigem[]>;
type ProgressTurnoRow = {
  case_id: string | null;
  turno: string | null;
  module_id: string | null;
  status: string | null;
  created_at: string | null;
};
type TurmaModuleSummaryItem = {
  moduleId: string;
  startedAt: string | null;
  members: number;
};
type TurmaModuleSummaryByTurno = Record<TurnoOrigem, TurmaModuleSummaryItem[]>;
type TurmaPlanningRow = {
  turno: string | null;
  module_id: string | null;
  start_date: string | null;
};

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

function isMissingProgressTurnoColumnError(message: string, code?: string) {
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("'turno' column of 'discipleship_progress'") ||
    (message.includes("discipleship_progress") && message.includes("turno"))
  );
}

function isMissingTurmaPlanningTableError(message: string, code?: string) {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("discipleship_turma_settings") ||
    message.includes("start_date") ||
    message.includes("module_id")
  );
}

function createEmptyTurmaModuleSummaryByTurno(): TurmaModuleSummaryByTurno {
  return {
    MANHA: [],
    TARDE: [],
    NOITE: [],
    NAO_INFORMADO: []
  };
}

function createEmptyTurmaPlanningByTurno(): TurmaPlanningByTurno {
  return {
    MANHA: { moduleId: "", startDate: "" },
    TARDE: { moduleId: "", startDate: "" },
    NOITE: { moduleId: "", startDate: "" },
    NAO_INFORMADO: { moduleId: "", startDate: "" }
  };
}

function formatDateBR(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR", { timeZone: "America/Manaus" });
}

function buildCaseTurnosByCaseId(rows: ProgressTurnoRow[]): CaseTurnosByCaseId {
  const map = new Map<string, Set<TurnoOrigem>>();
  for (const row of rows) {
    const caseId = String(row.case_id ?? "");
    if (!caseId) continue;
    const normalized = normalizeTurnoOrigem(row.turno);
    if (normalized === "NAO_INFORMADO") continue;
    const current = map.get(caseId) ?? new Set<TurnoOrigem>();
    current.add(normalized);
    map.set(caseId, current);
  }

  const asObject: CaseTurnosByCaseId = {};
  for (const [caseId, values] of map.entries()) {
    asObject[caseId] = Array.from(values).sort((a, b) => TURNO_ORDER.indexOf(a) - TURNO_ORDER.indexOf(b));
  }
  return asObject;
}

function buildTurmaModuleSummaryByTurno(rows: ProgressTurnoRow[]): TurmaModuleSummaryByTurno {
  const summary = createEmptyTurmaModuleSummaryByTurno();
  const mapByTurno: Record<TurnoOrigem, Map<string, TurmaModuleSummaryItem>> = {
    MANHA: new Map<string, TurmaModuleSummaryItem>(),
    TARDE: new Map<string, TurmaModuleSummaryItem>(),
    NOITE: new Map<string, TurmaModuleSummaryItem>(),
    NAO_INFORMADO: new Map<string, TurmaModuleSummaryItem>()
  };

  for (const row of rows) {
    if (row.status !== "em_andamento") continue;

    const turno = normalizeTurnoOrigem(row.turno);
    const moduleId = String(row.module_id ?? "");
    if (!moduleId) continue;

    const current = mapByTurno[turno].get(moduleId);
    if (!current) {
      mapByTurno[turno].set(moduleId, {
        moduleId,
        startedAt: row.created_at ?? null,
        members: 1
      });
      continue;
    }

    current.members += 1;
    if (row.created_at && (!current.startedAt || row.created_at < current.startedAt)) {
      current.startedAt = row.created_at;
    }
  }

  for (const turno of TURNO_ORDER) {
    summary[turno] = Array.from(mapByTurno[turno].values()).sort((a, b) => {
      const membersDiff = b.members - a.members;
      if (membersDiff !== 0) return membersDiff;
      const aStart = a.startedAt ?? "9999-12-31T23:59:59.999Z";
      const bStart = b.startedAt ?? "9999-12-31T23:59:59.999Z";
      return aStart.localeCompare(bStart);
    });
  }

  return summary;
}

function deriveTurnoStatus(cases: DiscipleshipCaseSummaryItem[]): TurmaStatusValue {
  if (!cases.length) return "em_discipulado";
  const normalized = cases.map((item) => toTurmaStatusValue(item.status));
  const allConcluded = normalized.every((item) => item === "concluido");
  if (allConcluded) return "concluido";
  const allPaused = normalized.every((item) => item === "pausado");
  if (allPaused) return "pausado";
  return "em_discipulado";
}

function groupCasesByTurnos(
  items: DiscipleshipCaseSummaryItem[],
  caseTurnosByCaseId: CaseTurnosByCaseId
): Record<TurnoOrigem, DiscipleshipCaseSummaryItem[]> {
  const grouped: Record<TurnoOrigem, DiscipleshipCaseSummaryItem[]> = {
    MANHA: [],
    TARDE: [],
    NOITE: [],
    NAO_INFORMADO: []
  };

  for (const item of items) {
    const enrolledTurnos = caseTurnosByCaseId[item.case_id] ?? [];
    const targetTurnos = enrolledTurnos.length ? enrolledTurnos : [normalizeTurnoOrigem(item.turno_origem)];

    for (const turno of targetTurnos) {
      grouped[turno].push(item);
    }
  }

  return grouped;
}

function CaseCard({
  item,
  moduleNameById,
  caseTurnosByCaseId
}: {
  item: DiscipleshipCaseSummaryItem;
  moduleNameById: ModuleLookup;
  caseTurnosByCaseId: CaseTurnosByCaseId;
}) {
  const caseTurno = turnoLabel(normalizeTurnoOrigem(item.turno_origem));
  const caseStatus = statusLabel(item.status);
  const moduloAtual = item.modulo_atual_id
    ? (moduleNameById[item.modulo_atual_id] ?? `#${item.modulo_atual_id.slice(0, 8)}`)
    : "Sem módulo";
  const enrolledTurnos = caseTurnosByCaseId[item.case_id] ?? [];
  const enrolledTurnosLabel = enrolledTurnos.length ? enrolledTurnos.map(turnoLabel).join(" • ") : caseTurno;
  const hasMultiTurno = enrolledTurnos.length > 1;

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
      <p className="text-xs text-slate-700">
        Turnos nos módulos: <strong>{enrolledTurnosLabel}</strong>
        {hasMultiTurno ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">MULTITURNO</span> : null}
      </p>
      <p className="mt-1 text-xs text-slate-700">
        Responsável: <strong>{item.discipulador_email ?? "A definir"}</strong>
      </p>
    </article>
  );
}

function TurmaModuleSummary({
  turnoKey,
  moduleNameById,
  moduleSummaryByTurno
}: {
  turnoKey: TurnoOrigem;
  moduleNameById: ModuleLookup;
  moduleSummaryByTurno: TurmaModuleSummaryByTurno;
}) {
  const summaries = moduleSummaryByTurno[turnoKey] ?? [];
  if (!summaries.length) {
    return <p className="mt-2 text-xs text-slate-500">Sem módulo em andamento nesta turma.</p>;
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">{summaries.length === 1 ? "Módulo ministrado" : "Módulos ministrados"}</p>
      <div className="mt-1 space-y-1">
        {summaries.map((summary) => {
          const moduleName = moduleNameById[summary.moduleId] ?? `#${summary.moduleId.slice(0, 8)}`;
          return (
            <p key={summary.moduleId} className="text-xs text-slate-700">
              <strong>{moduleName}</strong> • Início: <strong>{formatDateBR(summary.startedAt)}</strong> • Membros:{" "}
              <strong>{summary.members}</strong>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function TurmaPlanningForm({
  turnoKey,
  draft,
  moduleOptions,
  saving,
  onChange,
  onSave
}: {
  turnoKey: TurnoOrigem;
  draft: TurmaPlanningDraft;
  moduleOptions: ModuleOption[];
  saving: boolean;
  onChange: (next: TurmaPlanningDraft) => void;
  onSave: (turnoKey: TurnoOrigem) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:max-w-md">
      <p className="text-xs font-semibold text-slate-700">Dados da turma</p>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-600">Módulo ministrado</span>
        <select
          value={draft.moduleId}
          onChange={(event) =>
            onChange({
              ...draft,
              moduleId: event.target.value
            })
          }
          disabled={saving}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">Não informado</option>
          {moduleOptions.map((moduleOption) => (
            <option key={moduleOption.id} value={moduleOption.id}>
              {moduleOption.title}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-600">Data de início</span>
        <input
          type="date"
          value={draft.startDate}
          onChange={(event) =>
            onChange({
              ...draft,
              startDate: event.target.value
            })
          }
          disabled={saving}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </label>
      <button
        type="button"
        onClick={() => onSave(turnoKey)}
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {saving ? "Salvando dados..." : "Salvar dados da turma"}
      </button>
    </div>
  );
}

export default function DiscipuladoBoardPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentCongregationId, setCurrentCongregationId] = useState<string | null>(null);
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [mobileTurno, setMobileTurno] = useState<TurnoOrigem>("MANHA");
  const [savingTurnoStatusKey, setSavingTurnoStatusKey] = useState<TurnoOrigem | null>(null);
  const [savingTurmaPlanningKey, setSavingTurmaPlanningKey] = useState<TurnoOrigem | null>(null);
  const [turnoStatusDrafts, setTurnoStatusDrafts] = useState<Record<TurnoOrigem, TurmaStatusValue>>({
    MANHA: "em_discipulado",
    TARDE: "em_discipulado",
    NOITE: "em_discipulado",
    NAO_INFORMADO: "em_discipulado"
  });
  const [turmaPlanningDrafts, setTurmaPlanningDrafts] = useState<TurmaPlanningByTurno>(createEmptyTurmaPlanningByTurno());
  const [moduleNameById, setModuleNameById] = useState<ModuleLookup>({});
  const [moduleOptions, setModuleOptions] = useState<ModuleOption[]>([]);
  const [caseTurnosByCaseId, setCaseTurnosByCaseId] = useState<CaseTurnosByCaseId>({});
  const [moduleSummaryByTurno, setModuleSummaryByTurno] = useState<TurmaModuleSummaryByTurno>(
    createEmptyTurmaModuleSummaryByTurno()
  );

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
      setCurrentCongregationId(scope.congregationId ?? null);

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
      setCaseTurnosByCaseId({});
      setModuleSummaryByTurno(createEmptyTurmaModuleSummaryByTurno());
      setTurmaPlanningDrafts(createEmptyTurmaPlanningByTurno());

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
        setModuleOptions(
          (modulesData ?? []).map((moduleItem) => ({
            id: String(moduleItem.id ?? ""),
            title: String(moduleItem.title ?? "Módulo")
          }))
        );

        let turmaPlanningQuery = supabaseClient
          .from("discipleship_turma_settings")
          .select("turno, module_id, start_date");
        if (scope.congregationId) {
          turmaPlanningQuery = turmaPlanningQuery.eq("congregation_id", scope.congregationId);
        }
        const turmaPlanningResult = await turmaPlanningQuery;
        if (turmaPlanningResult.error) {
          if (!isMissingTurmaPlanningTableError(turmaPlanningResult.error.message, turmaPlanningResult.error.code)) {
            setStatusMessage((prev) => prev || turmaPlanningResult.error?.message || "");
          }
        } else {
          const nextPlanningDrafts = createEmptyTurmaPlanningByTurno();
          const rows = (turmaPlanningResult.data ?? []) as TurmaPlanningRow[];
          for (const row of rows) {
            const turnoKey = normalizeTurnoOrigem(row.turno);
            nextPlanningDrafts[turnoKey] = {
              moduleId: String(row.module_id ?? ""),
              startDate: row.start_date ? String(row.start_date).slice(0, 10) : ""
            };
          }
          setTurmaPlanningDrafts(nextPlanningDrafts);
        }
      }

      if (supabaseClient && discipuladoCases.length) {
        const caseIds = discipuladoCases.map((item) => item.case_id);
        const progressTurnosResult = await supabaseClient
          .from("discipleship_progress")
          .select("case_id, turno, module_id, status, created_at")
          .in("case_id", caseIds);

        if (progressTurnosResult.error) {
          if (!isMissingProgressTurnoColumnError(progressTurnosResult.error.message, progressTurnosResult.error.code)) {
            setStatusMessage((prev) => prev || progressTurnosResult.error?.message || "");
          }
        } else {
          const progressRows = (progressTurnosResult.data ?? []) as ProgressTurnoRow[];
          const turnosByCase = buildCaseTurnosByCaseId(progressRows);
          const moduleSummary = buildTurmaModuleSummaryByTurno(progressRows);
          if (!active) return;
          setCaseTurnosByCaseId(turnosByCase);
          setModuleSummaryByTurno(moduleSummary);
        }
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const orderedCases = useMemo(() => sortCases(cases), [cases]);
  const byTurno = useMemo(() => groupCasesByTurnos(orderedCases, caseTurnosByCaseId), [orderedCases, caseTurnosByCaseId]);

  useEffect(() => {
    setTurnoStatusDrafts({
      MANHA: deriveTurnoStatus(byTurno.MANHA),
      TARDE: deriveTurnoStatus(byTurno.TARDE),
      NOITE: deriveTurnoStatus(byTurno.NOITE),
      NAO_INFORMADO: deriveTurnoStatus(byTurno.NAO_INFORMADO)
    });
  }, [byTurno]);

  async function handleSaveTurmaStatus(turnoKey: TurnoOrigem) {
    if (!supabaseClient || savingTurnoStatusKey) return;
    const turmaCases = byTurno[turnoKey] ?? [];
    if (!turmaCases.length) return;

    setSavingTurnoStatusKey(turnoKey);
    setStatusMessage("");
    const nextStatus = turnoStatusDrafts[turnoKey] ?? deriveTurnoStatus(turmaCases);
    const caseIds = turmaCases.map((item) => item.case_id);

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({
        status: nextStatus,
        fase: "DISCIPULADO"
      })
      .in("id", caseIds);

    if (error) {
      setStatusMessage(error.message);
      setSavingTurnoStatusKey(null);
      return;
    }

    const caseIdSet = new Set(caseIds);
    setCases((prev) =>
      prev.map((item) =>
        caseIdSet.has(item.case_id)
          ? {
              ...item,
              status: nextStatus,
              fase: "DISCIPULADO"
            }
          : item
      )
    );

    setSavingTurnoStatusKey(null);
  }

  async function handleSaveTurmaPlanning(turnoKey: TurnoOrigem) {
    if (!supabaseClient || savingTurmaPlanningKey) return;

    if (!currentCongregationId) {
      setStatusMessage("Não foi possível identificar a congregação para salvar os dados da turma.");
      return;
    }

    setSavingTurmaPlanningKey(turnoKey);
    setStatusMessage("");

    const draft = turmaPlanningDrafts[turnoKey] ?? { moduleId: "", startDate: "" };
    const { error } = await supabaseClient.from("discipleship_turma_settings").upsert(
      {
        congregation_id: currentCongregationId,
        turno: turnoKey,
        module_id: draft.moduleId || null,
        start_date: draft.startDate || null
      },
      {
        onConflict: "congregation_id,turno"
      }
    );

    if (error) {
      if (isMissingTurmaPlanningTableError(error.message, error.code)) {
        setStatusMessage(
          "Configuração da turma indisponível neste ambiente. Aplique a migração 0050_discipulado_turma_planejamento.sql."
        );
      } else {
        setStatusMessage(error.message);
      }
      setSavingTurmaPlanningKey(null);
      return;
    }

    setSavingTurmaPlanningKey(null);
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
              <TurmaPlanningForm
                turnoKey={mobileTurno}
                draft={turmaPlanningDrafts[mobileTurno]}
                moduleOptions={moduleOptions}
                saving={savingTurmaPlanningKey === mobileTurno}
                onChange={(next) =>
                  setTurmaPlanningDrafts((prev) => ({
                    ...prev,
                    [mobileTurno]: next
                  }))
                }
                onSave={(turnoKey) => {
                  void handleSaveTurmaPlanning(turnoKey);
                }}
              />
              <TurmaModuleSummary
                turnoKey={mobileTurno}
                moduleNameById={moduleNameById}
                moduleSummaryByTurno={moduleSummaryByTurno}
              />
              {(byTurno[mobileTurno] ?? []).length ? (
                <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Status da turma</span>
                    <select
                      value={turnoStatusDrafts[mobileTurno]}
                      onChange={(event) =>
                        setTurnoStatusDrafts((prev) => ({
                          ...prev,
                          [mobileTurno]: event.target.value as TurmaStatusValue
                        }))
                      }
                      disabled={savingTurnoStatusKey === mobileTurno}
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
                      void handleSaveTurmaStatus(mobileTurno);
                    }}
                    disabled={savingTurnoStatusKey === mobileTurno}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {savingTurnoStatusKey === mobileTurno ? "Salvando status..." : "Salvar status da turma"}
                  </button>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {!(byTurno[mobileTurno] ?? []).length ? (
                  <p className="text-xs text-slate-500">Sem cases neste turno.</p>
                ) : (
                  (byTurno[mobileTurno] ?? []).map((item) => (
                    <CaseCard
                      key={item.case_id}
                      item={item}
                      moduleNameById={moduleNameById}
                      caseTurnosByCaseId={caseTurnosByCaseId}
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
                  <TurmaPlanningForm
                    turnoKey={turno.key}
                    draft={turmaPlanningDrafts[turno.key]}
                    moduleOptions={moduleOptions}
                    saving={savingTurmaPlanningKey === turno.key}
                    onChange={(next) =>
                      setTurmaPlanningDrafts((prev) => ({
                        ...prev,
                        [turno.key]: next
                      }))
                    }
                    onSave={(turnoKey) => {
                      void handleSaveTurmaPlanning(turnoKey);
                    }}
                  />
                  <TurmaModuleSummary
                    turnoKey={turno.key}
                    moduleNameById={moduleNameById}
                    moduleSummaryByTurno={moduleSummaryByTurno}
                  />
                  {turnoCases.length ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:max-w-sm">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Status da turma</span>
                        <select
                          value={turnoStatusDrafts[turno.key]}
                          onChange={(event) =>
                            setTurnoStatusDrafts((prev) => ({
                              ...prev,
                              [turno.key]: event.target.value as TurmaStatusValue
                            }))
                          }
                          disabled={savingTurnoStatusKey === turno.key}
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
                          void handleSaveTurmaStatus(turno.key);
                        }}
                        disabled={savingTurnoStatusKey === turno.key}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {savingTurnoStatusKey === turno.key ? "Salvando status..." : "Salvar status da turma"}
                      </button>
                    </div>
                  ) : null}
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
                          caseTurnosByCaseId={caseTurnosByCaseId}
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
