"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAuthScope } from "@/lib/authScope";
import {
  groupByModulo,
  groupByTurno,
  ModuloOption,
  normalizeTurnoOrigem,
  sortCases,
  TurnoOrigem
} from "@/lib/discipuladoPanels";
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

function turnoLabel(key: TurnoOrigem) {
  return TURNOS.find((item) => item.key === key)?.label ?? "Não informado";
}

function CaseCard({
  item,
  modules,
  movingCaseId,
  onMove
}: {
  item: DiscipleshipCaseSummaryItem;
  modules: ModuloOption[];
  movingCaseId: string | null;
  onMove: (caseId: string, moduloId: string | null) => Promise<void>;
}) {
  const isMoving = movingCaseId === item.case_id;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{item.member_name}</p>
      <p className="mt-1 text-xs text-slate-600">{item.member_phone ?? "-"}</p>
      <div className="mt-2 flex items-center gap-2">
        <StatusBadge value={item.criticality} />
        <span className="text-xs text-slate-600">{criticalityLabel(item.criticality)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-700">
        Dias para confra: <strong>{item.days_to_confra ?? "-"}</strong> • Negativos: <strong>{item.negative_contact_count}</strong>
      </p>

      <label className="mt-3 block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Mover para módulo</span>
        <select
          value={item.modulo_atual_id ?? ""}
          onChange={(event) => {
            const nextValue = event.target.value.trim();
            void onMove(item.case_id, nextValue || null);
          }}
          disabled={isMoving}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">Sem módulo</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.nome}
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
  const [modules, setModules] = useState<ModuloOption[]>([]);
  const [movingCaseId, setMovingCaseId] = useState<string | null>(null);
  const [mobileTurno, setMobileTurno] = useState<TurnoOrigem>("MANHA");

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

      const [casesResult, modulesResult] = await Promise.all([
        loadDiscipleshipCaseSummariesWithFallback(),
        supabaseClient
          ?.from("discipleship_modules")
          .select("id, title, sort_order, is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      ]);

      if (!active) return;

      if (casesResult.errorMessage) {
        setStatusMessage(casesResult.errorMessage);
      }

      const discipuladoCases = (casesResult.data ?? []).filter((item) => item.fase === "DISCIPULADO");
      setCases(discipuladoCases);

      if (modulesResult && !modulesResult.error) {
        const mappedModules = (modulesResult.data ?? []).map((item) => ({
          id: String(item.id),
          nome: String(item.title ?? "Módulo"),
          ordem: Number(item.sort_order ?? 0),
          ativo: Boolean(item.is_active)
        }));
        setModules(mappedModules);
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

  async function handleMoveCase(caseId: string, moduloId: string | null) {
    if (!supabaseClient || movingCaseId) return;

    setMovingCaseId(caseId);
    setStatusMessage("");

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({ modulo_atual_id: moduloId })
      .eq("id", caseId);

    if (error) {
      setStatusMessage(error.message);
      setMovingCaseId(null);
      return;
    }

    setCases((prev) =>
      prev.map((item) =>
        item.case_id === caseId
          ? {
              ...item,
              modulo_atual_id: moduloId
            }
          : item
      )
    );

    setMovingCaseId(null);
  }

  if (!hasAccess) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Discipulado</h2>
        <p className="mt-1 text-xs text-slate-600">Cases na fase DISCIPULADO organizados por turno e módulo.</p>
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
            {(() => {
              const turnoCases = byTurno[mobileTurno] ?? [];
              const moduloGroups = groupByModulo(turnoCases, modules).map((group) => ({
                ...group,
                items: sortCases(group.items)
              }));

              return (
                <section className="discipulado-panel p-4">
                  <h3 className="text-sm font-semibold text-sky-900">{turnoLabel(mobileTurno)}</h3>
                  <div className="mt-3 space-y-3">
                    {moduloGroups.map((group) => (
                      <details key={String(group.id ?? "sem-modulo")} className="rounded-lg border border-slate-200 bg-white">
                        <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-900">
                          {group.nome} ({group.items.length})
                        </summary>
                        <div className="space-y-2 border-t border-slate-100 p-3">
                          {!group.items.length ? (
                            <p className="text-xs text-slate-500">Sem cases neste módulo.</p>
                          ) : (
                            group.items.map((item) => (
                              <CaseCard
                                key={item.case_id}
                                item={item}
                                modules={modules}
                                movingCaseId={movingCaseId}
                                onMove={handleMoveCase}
                              />
                            ))
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>

          <div className="hidden space-y-4 md:block">
            {TURNOS.map((turno) => {
              const turnoCases = byTurno[turno.key] ?? [];
              const moduloGroups = groupByModulo(turnoCases, modules).map((group) => ({
                ...group,
                items: sortCases(group.items)
              }));

              return (
                <section key={turno.key} className="discipulado-panel p-4">
                  <h3 className="text-sm font-semibold text-sky-900">{turno.label}</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {moduloGroups.map((group) => (
                      <article key={String(group.id ?? "sem-modulo")} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            {group.nome} ({group.items.length})
                          </p>
                        </div>
                        <div className="space-y-2">
                          {!group.items.length ? (
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                              Sem cases neste módulo.
                            </p>
                          ) : (
                            group.items.map((item) => (
                              <CaseCard
                                key={item.case_id}
                                item={item}
                                modules={modules}
                                movingCaseId={movingCaseId}
                                onMove={handleMoveCase}
                              />
                            ))
                          )}
                        </div>
                      </article>
                    ))}
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
