"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthScope } from "@/lib/authScope";
import {
  groupByTurno,
  ModuloOption,
  normalizeTurnoOrigem,
  TurnoOrigem
} from "@/lib/discipuladoPanels";
import {
  DiscipleshipCaseSummaryItem,
  loadDiscipleshipCaseSummariesWithFallback
} from "@/lib/discipleshipCases";
import { supabaseClient } from "@/lib/supabaseClient";

const TURNO_FILTERS: Array<{ key: "TODOS" | TurnoOrigem; label: string }> = [
  { key: "TODOS", label: "Todos" },
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
  { key: "NAO_INFORMADO", label: "Não informado" }
];

function turnoLabel(key: TurnoOrigem) {
  if (key === "MANHA") return "Manhã";
  if (key === "TARDE") return "Tarde";
  if (key === "NOITE") return "Noite";
  return "Não informado";
}

export default function IntegracaoPosDiscipuladoPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [modules, setModules] = useState<ModuloOption[]>([]);
  const [turnoFilter, setTurnoFilter] = useState<"TODOS" | TurnoOrigem>("TODOS");
  const [search, setSearch] = useState("");

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
        loadDiscipleshipCaseSummariesWithFallback({
          includeExtraFields: true
        }),
        supabaseClient
          ?.from("discipleship_modules")
          .select("id, title, sort_order, is_active")
          .order("sort_order", { ascending: true })
      ]);

      if (!active) return;

      if (casesResult.errorMessage) {
        setStatusMessage(casesResult.errorMessage);
      }

      setCases((casesResult.data ?? []).filter((item) => item.fase === "POS_DISCIPULADO"));

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

  const moduleNameById = useMemo(() => new Map(modules.map((item) => [item.id, item.nome])), [modules]);

  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase();

    return cases.filter((item) => {
      const turno = normalizeTurnoOrigem(item.turno_origem);
      const byTurno = turnoFilter === "TODOS" || turno === turnoFilter;
      const bySearch = !term || item.member_name.toLowerCase().includes(term);
      return byTurno && bySearch;
    });
  }, [cases, search, turnoFilter]);

  const countsByTurno = useMemo(() => {
    const grouped = groupByTurno(cases);
    return {
      MANHA: grouped.MANHA.length,
      TARDE: grouped.TARDE.length,
      NOITE: grouped.NOITE.length,
      NAO_INFORMADO: grouped.NAO_INFORMADO.length
    };
  }, [cases]);

  if (!hasAccess) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Integração pós-discipulado</h2>
        <p className="mt-1 text-xs text-slate-600">Cases na fase POS_DISCIPULADO prontos para integração.</p>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      {loading ? <div className="discipulado-panel p-4 text-sm text-slate-600">Carregando painel...</div> : null}

      {!loading ? (
        <>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
              {TURNO_FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTurnoFilter(item.key)}
                  className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    turnoFilter === item.key
                      ? "border-sky-700 bg-sky-700 text-white"
                      : "border-sky-200 bg-white text-sky-900 hover:bg-sky-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="discipulado-panel p-4">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">Total: {cases.length}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Manhã: {countsByTurno.MANHA}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Tarde: {countsByTurno.TARDE}</span>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Noite: {countsByTurno.NOITE}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Não informado: {countsByTurno.NAO_INFORMADO}</span>
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            />
          </div>

          <div className="space-y-2 md:hidden">
            {!filteredCases.length ? (
              <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum case encontrado.</div>
            ) : null}
            {filteredCases.map((item) => {
              const turno = normalizeTurnoOrigem(item.turno_origem);
              const moduloFinal = item.modulo_atual_id ? moduleNameById.get(item.modulo_atual_id) ?? "Módulo não encontrado" : "Sem módulo";
              return (
                <article key={item.case_id} className="discipulado-panel p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.member_name}</p>
                  <p className="mt-1 text-xs text-slate-600">{turnoLabel(turno)}</p>
                  <p className="mt-1 text-xs text-slate-600">Módulo final: {moduloFinal}</p>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Turno</th>
                  <th className="px-3 py-2">Módulo final</th>
                </tr>
              </thead>
              <tbody>
                {!filteredCases.length ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={3}>
                      Nenhum case encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((item) => {
                    const turno = normalizeTurnoOrigem(item.turno_origem);
                    const moduloFinal = item.modulo_atual_id
                      ? moduleNameById.get(item.modulo_atual_id) ?? "Módulo não encontrado"
                      : "Sem módulo";

                    return (
                      <tr key={item.case_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-900">{item.member_name}</td>
                        <td className="px-3 py-2 text-slate-700">{turnoLabel(turno)}</td>
                        <td className="px-3 py-2 text-slate-700">{moduloFinal}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
