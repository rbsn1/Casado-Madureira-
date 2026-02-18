"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type DashboardCards = {
  em_discipulado: number;
  concluidos: number;
  parados: number;
  pendentes_criticos: number;
  proximos_a_concluir: number;
};

type DashboardListItem = {
  id: string;
  member_name: string;
  days_without_activity?: number;
  progress: number;
  done_modules?: number;
  total_modules?: number;
};

type Congregation = {
  id: string;
  name: string;
};

const emptyCards: DashboardCards = {
  em_discipulado: 0,
  concluidos: 0,
  parados: 0,
  pendentes_criticos: 0,
  proximos_a_concluir: 0
};

function normalizeDashboardErrorMessage(message: string) {
  if (message === "not allowed") {
    return "Sem permissão no banco para o dashboard do discipulado. Aplique a migração 0038_admin_discipulado_acesso_total.sql ou atribua a role DISCIPULADOR.";
  }
  if (message === "congregation inactive") {
    return "A congregação vinculada ao usuário está inativa. Ative a congregação no módulo Admin do discipulado.";
  }
  return message;
}

export default function DiscipuladoDashboardPage() {
  const [statusMessage, setStatusMessage] = useState("");
  const [cards, setCards] = useState<DashboardCards>(emptyCards);
  const [stalled, setStalled] = useState<DashboardListItem[]>([]);
  const [almostDone, setAlmostDone] = useState<DashboardListItem[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [canManageDiscipulado, setCanManageDiscipulado] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [congregationFilter, setCongregationFilter] = useState("");

  const loadDashboard = useCallback(
    async (adminMaster: boolean, targetCongregation: string) => {
      if (!supabaseClient) return;
      setStatusMessage("");
      const { data, error } = await supabaseClient.rpc("get_discipleship_dashboard", {
        stale_days: 14,
        target_congregation_id: adminMaster ? targetCongregation || null : null
      });

      if (error) {
        setStatusMessage(normalizeDashboardErrorMessage(error.message));
        return;
      }

      const payload = (data ?? {}) as {
        cards?: DashboardCards;
        parados_lista?: DashboardListItem[];
        proximos_lista?: DashboardListItem[];
      };
      setCards(payload.cards ?? emptyCards);
      setStalled(payload.parados_lista ?? []);
      setAlmostDone(payload.proximos_lista ?? []);
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!supabaseClient) {
        if (active) setStatusMessage("Supabase não configurado.");
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;

      const hasDiscipuladorRole = scope.roles.includes("DISCIPULADOR");
      const hasAdminDiscipuladoRole = scope.roles.includes("ADMIN_DISCIPULADO");
      const allowed = hasDiscipuladorRole || hasAdminDiscipuladoRole;
      setHasAccess(allowed);
      setIsAdminMaster(false);
      setCanManageDiscipulado(hasAdminDiscipuladoRole);
      setCanCreateNovoConvertido(
        scope.roles.includes("ADMIN_DISCIPULADO") ||
          scope.roles.includes("DISCIPULADOR") ||
          scope.roles.includes("SM_DISCIPULADO") ||
          scope.roles.includes("SECRETARIA_DISCIPULADO")
      );

      if (!allowed) return;

      await loadDashboard(false, "");
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!hasAccess) return;
    loadDashboard(isAdminMaster, congregationFilter);
  }, [congregationFilter, hasAccess, isAdminMaster, loadDashboard]);

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito aos perfis do Discipulado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-2xl font-semibold text-sky-950">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          {isAdminMaster ? (
            <select
              value={congregationFilter}
              onChange={(event) => setCongregationFilter(event.target.value)}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
            >
              <option value="">Todas as congregações</option>
              {congregations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
          {canManageDiscipulado ? (
            <Link
              href="/discipulado/admin"
              className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-900 hover:border-sky-400"
            >
              Admin do discipulado
            </Link>
          ) : null}
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Em discipulado</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_discipulado}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Concluídos</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.concluidos}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Parados</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.parados}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Pendentes críticos</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.pendentes_criticos}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Próximos a concluir</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.proximos_a_concluir}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="discipulado-panel p-4">
          <h3 className="text-sm font-semibold text-sky-900">Parados</h3>
          <div className="mt-3 space-y-2">
            {!stalled.length ? <p className="text-sm text-slate-600">Sem casos parados no momento.</p> : null}
            {stalled.map((item) => (
              <Link
                key={item.id}
                href={`/discipulado/convertidos/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm hover:border-sky-200 hover:bg-sky-50/40"
              >
                <span className="font-medium text-slate-900">{item.member_name}</span>
                <span className="text-xs text-slate-600">{item.days_without_activity} dias</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="discipulado-panel p-4">
          <h3 className="text-sm font-semibold text-sky-900">Próximos a concluir</h3>
          <div className="mt-3 space-y-2">
            {!almostDone.length ? <p className="text-sm text-slate-600">Nenhum caso próximo de conclusão.</p> : null}
            {almostDone.map((item) => (
              <Link
                key={item.id}
                href={`/discipulado/convertidos/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm hover:border-sky-200 hover:bg-sky-50/40"
              >
                <span className="font-medium text-slate-900">{item.member_name}</span>
                <span className="text-xs text-slate-600">
                  {item.done_modules}/{item.total_modules} ({item.progress}%)
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
