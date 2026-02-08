"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/cards/StatCard";
import { InsightBarChart } from "@/components/charts/InsightBarChart";
import { MonthlyRegistrationsChart } from "@/components/charts/MonthlyRegistrationsChart";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { formatDateBR } from "@/lib/date";
import { useRouter } from "next/navigation";

type InsightEntry = { label: string; count: number };
type GrowthEntry = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
};
type MonthlyEntry = {
  month: number;
  count: number;
};

type DiscipleshipCards = {
  em_discipulado: number;
  concluidos: number;
  parados: number;
  pendentes_criticos: number;
  proximos_a_concluir: number;
};

type Congregation = {
  id: string;
  name: string;
};

function formatDate(value: Date) {
  return formatDateBR(value);
}

function getPeriodRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  if (period === "Personalizado" && customStart && customEnd) {
    return {
      start: new Date(customStart),
      end: new Date(customEnd)
    };
  }
  if (period === "Hoje") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start, end };
  }
  if (period === "Semana") {
    const end = now;
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start, end };
  }
  if (period === "Mês") {
    const end = now;
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { start, end };
  }
  return { start: null, end: null };
}

function formatDelta(delta: number, pct: number | null) {
  if (pct === null) return `${delta >= 0 ? "+" : ""}${delta}`;
  return `${delta >= 0 ? "+" : ""}${delta} (${delta >= 0 ? "+" : ""}${pct}%)`;
}

function isMissingRpcSignature(message: string | undefined, fnName: string) {
  if (!message) return false;
  return (
    message.includes(`Could not find the function public.${fnName}`) ||
    message.includes(`function public.${fnName}`)
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [kpi, setKpi] = useState({
    totalCasados: 0,
    cultoManha: 0,
    cultoNoite: 0
  });
  const [origem, setOrigem] = useState<InsightEntry[]>([]);
  const [igrejas, setIgrejas] = useState<InsightEntry[]>([]);
  const [bairros, setBairros] = useState<InsightEntry[]>([]);
  const [crescimentoBairros, setCrescimentoBairros] = useState<GrowthEntry[]>([]);
  const [crescimentoIgrejas, setCrescimentoIgrejas] = useState<GrowthEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [period, setPeriod] = useState("Mês");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(currentYear);
  const [mensal, setMensal] = useState<MonthlyEntry[]>([]);
  const [checkingRoles, setCheckingRoles] = useState(true);
  const [isCadastradorOnly, setIsCadastradorOnly] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [congregationFilter, setCongregationFilter] = useState("");
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [discipleshipCards, setDiscipleshipCards] = useState<DiscipleshipCards>({
    em_discipulado: 0,
    concluidos: 0,
    parados: 0,
    pendentes_criticos: 0,
    proximos_a_concluir: 0
  });
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  useEffect(() => {
    let active = true;

    async function checkRoles() {
      if (!supabaseClient) {
        if (active) setCheckingRoles(false);
        return;
      }
      const scope = await getAuthScope();
      if (!active) return;
      const roles = scope.roles;
      const onlyCadastrador = roles.length === 1 && roles.includes("CADASTRADOR");
      setIsCadastradorOnly(onlyCadastrador);
      setUserRoles(roles);
      setIsAdminMaster(scope.isAdminMaster);
      if (scope.isAdminMaster) {
        const { data } = await supabaseClient
          .from("congregations")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        if (!active) return;
        setCongregations((data ?? []) as Congregation[]);
      }
      setCheckingRoles(false);
      if (onlyCadastrador) {
        router.replace("/cadastro");
      }
    }

    checkRoles();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (checkingRoles || isCadastradorOnly) return;

    async function loadDashboard() {
      if (!supabaseClient) {
        setStatusMessage("Supabase não configurado.");
        return;
      }

      const range = getPeriodRange(period, customStart, customEnd);
      const casadosParams = {
        start_ts: range.start ? range.start.toISOString() : null,
        end_ts: range.end ? range.end.toISOString() : null,
        year: anoSelecionado
      };
      const casadosWithCongregation = {
        ...casadosParams,
        target_congregation_id: isAdminMaster ? congregationFilter || null : null
      };

      const [casadosPrimary, discipleshipResult] = await Promise.all([
        supabaseClient.rpc("get_casados_dashboard", casadosWithCongregation),
        userRoles.includes("ADMIN_MASTER") || userRoles.includes("DISCIPULADOR")
          ? supabaseClient.rpc("get_discipleship_dashboard", {
              stale_days: 14,
              target_congregation_id: isAdminMaster ? congregationFilter || null : null
            })
          : Promise.resolve({ data: null, error: null } as any)
      ]);

      const casadosResult =
        casadosPrimary.error && isMissingRpcSignature(casadosPrimary.error.message, "get_casados_dashboard")
          ? await supabaseClient.rpc("get_casados_dashboard", casadosParams)
          : casadosPrimary;
      const data = casadosResult.data;
      const error = casadosResult.error;

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      const origemEntries = (data?.origem ?? []).map((item: any) => ({ label: item.label, count: item.count }));
      const manha = origemEntries.find((item: InsightEntry) => item.label === "Manhã")?.count ?? 0;
      const noite = origemEntries.find((item: InsightEntry) => item.label === "Noite")?.count ?? 0;

      setKpi({
        totalCasados: data?.total ?? 0,
        cultoManha: manha,
        cultoNoite: noite
      });
      setOrigem(origemEntries);
      setIgrejas((data?.igrejas ?? []).map((item: any) => ({ label: item.label, count: item.count })));
      setBairros((data?.bairros ?? []).map((item: any) => ({ label: item.label, count: item.count })));
      setCrescimentoBairros((data?.crescimento_bairros ?? []) as GrowthEntry[]);
      setCrescimentoIgrejas((data?.crescimento_igrejas ?? []) as GrowthEntry[]);
      setAnosDisponiveis(data?.anos_disponiveis ?? []);
      if (!data?.anos_disponiveis?.includes(anoSelecionado) && data?.ano_selecionado) {
        setAnoSelecionado(data.ano_selecionado);
      }
      setMensal((data?.cadastros_mensais ?? []) as MonthlyEntry[]);

      if (!discipleshipResult?.error && discipleshipResult?.data?.cards) {
        setDiscipleshipCards(discipleshipResult.data.cards as DiscipleshipCards);
      }
    }

    loadDashboard();
  }, [
    period,
    customStart,
    customEnd,
    anoSelecionado,
    checkingRoles,
    isCadastradorOnly,
    congregationFilter,
    isAdminMaster,
    userRoles
  ]);

  function handleMonthClick(year: number, month: number) {
    const monthValue = String(month).padStart(2, "0");
    window.location.href = `/cadastros?mes=${year}-${monthValue}`;
  }

  const sugestao = useMemo(() => {
    const positivos = [...crescimentoBairros, ...crescimentoIgrejas].filter((item) => (item.delta_pct ?? 0) > 0);
    if (!positivos.length) return "Sem variações relevantes no período.";
    const top = positivos.sort((a, b) => (b.delta_pct ?? 0) - (a.delta_pct ?? 0))[0];
    return `${top.label} ↑${top.delta_pct}% no período — considerar ação de evangelismo local.`;
  }, [crescimentoBairros, crescimentoIgrejas]);

  function getOrigemHref(label: string) {
    const mapa: Record<string, string> = {
      Manhã: "manha",
      Noite: "noite",
      Evento: "evento",
      "Célula": "celula",
      Outro: "outro"
    };
    const value = mapa[label] ?? "outro";
    return `/cadastros?origem_tipo=${encodeURIComponent(value)}`;
  }

  const periodSummary = useMemo(() => {
    const range = getPeriodRange(period, customStart, customEnd);
    if (!range.start || !range.end) return "Selecione um período para acompanhar a movimentação.";
    return `${formatDate(range.start)} – ${formatDate(range.end)}`;
  }, [period, customStart, customEnd]);

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Visão geral</p>
            <h2 className="mt-1 text-2xl font-semibold text-emerald-900">Resumo do período</h2>
            <p className="mt-1 text-sm text-slate-600">{periodSummary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdminMaster ? (
              <select
                value={congregationFilter}
                onChange={(event) => setCongregationFilter(event.target.value)}
                className="rounded-full border border-brand-100 bg-white px-3 py-1 text-sm font-medium text-brand-900 focus:border-emerald-300 focus:outline-none"
              >
                <option value="">Todas as congregações</option>
                {congregations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
            {["Hoje", "Semana", "Mês", "Personalizado"].map((label) => (
              <button
                key={label}
                onClick={() => setPeriod(label)}
                className={`rounded-full border border-brand-100 px-3 py-1 text-sm font-medium transition ${
                  period === label
                    ? "bg-brand-900 text-white shadow-sm"
                    : "bg-white text-brand-900 hover:bg-brand-100/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {period === "Personalizado" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-4">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Início</span>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Fim</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="pill bg-emerald-100 text-emerald-900">Atalhos</span>
          {[
            { label: "Cadastros do mês", href: `/cadastros?mes=${currentYear}-${currentMonth}` },
            { label: "Origem manhã", href: "/cadastros?origem_tipo=manha" },
            { label: "Origem noite", href: "/cadastros?origem_tipo=noite" },
            { label: "Origem evento", href: "/cadastros?origem_tipo=evento" }
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-medium text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total de casados" value={kpi.totalCasados} hint="Base cadastrada" tone="emerald" />
        <StatCard label="Culto da manhã" value={kpi.cultoManha} hint="Origem: manhã" tone="sky" />
        <StatCard label="Culto da noite" value={kpi.cultoNoite} hint="Origem: noite" tone="amber" />
      </div>

      {userRoles.includes("ADMIN_MASTER") || userRoles.includes("DISCIPULADOR") ? (
        <section className="card border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Discipulado</p>
              <h3 className="text-lg font-semibold text-sky-950">Indicadores integrados</h3>
            </div>
            <Link
              href="/discipulado"
              className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-50"
            >
              Abrir módulo
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-sky-100 bg-white p-3">
              <p className="text-xs text-slate-600">Em discipulado</p>
              <p className="text-2xl font-semibold text-sky-950">{discipleshipCards.em_discipulado}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white p-3">
              <p className="text-xs text-slate-600">Concluídos</p>
              <p className="text-2xl font-semibold text-sky-950">{discipleshipCards.concluidos}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white p-3">
              <p className="text-xs text-slate-600">Parados</p>
              <p className="text-2xl font-semibold text-sky-950">{discipleshipCards.parados}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white p-3">
              <p className="text-xs text-slate-600">Pendentes críticos</p>
              <p className="text-2xl font-semibold text-sky-950">{discipleshipCards.pendentes_criticos}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white p-3">
              <p className="text-xs text-slate-600">Próximos a concluir</p>
              <p className="text-2xl font-semibold text-sky-950">{discipleshipCards.proximos_a_concluir}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MonthlyRegistrationsChart
            entries={mensal}
            year={anoSelecionado}
            years={anosDisponiveis.length ? anosDisponiveis : [currentYear]}
            onYearChange={setAnoSelecionado}
            onMonthClick={handleMonthClick}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <InsightBarChart
              title="Top Igrejas / Congregações"
              badge="Origem"
              entries={igrejas}
              hrefForLabel={(label) =>
                label === "Sem igreja"
                  ? "/cadastros?igreja_origem=__null"
                  : `/cadastros?igreja_origem=${encodeURIComponent(label)}`
              }
            />
            <InsightBarChart
              title="Top Bairros"
              badge="Origem"
              entries={bairros}
              hrefForLabel={(label) =>
                label === "Sem bairro"
                  ? "/cadastros?bairro=__null"
                  : `/cadastros?bairro=${encodeURIComponent(label)}`
              }
            />
          </div>
          <InsightBarChart
            title="Origem do cadastro"
            badge="Manhã/Noite/Evento"
            entries={origem}
            hrefForLabel={getOrigemHref}
          />
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Crescimento por bairro</h3>
            <div className="mt-4 space-y-2">
              {crescimentoBairros.length ? (
                crescimentoBairros.map((item) => (
                  <Link
                    key={item.label}
                    href={item.label === "Sem bairro" ? "/cadastros?bairro=__null" : `/cadastros?bairro=${encodeURIComponent(item.label)}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-emerald-50"
                  >
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <span className={item.delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {formatDelta(item.delta, item.delta_pct)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sem dados no período selecionado.</p>
              )}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Crescimento por igreja de origem</h3>
            <div className="mt-4 space-y-2">
              {crescimentoIgrejas.length ? (
                crescimentoIgrejas.map((item) => (
                  <Link
                    key={item.label}
                    href={
                      item.label === "Sem igreja"
                        ? "/cadastros?igreja_origem=__null"
                        : `/cadastros?igreja_origem=${encodeURIComponent(item.label)}`
                    }
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-emerald-50"
                  >
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <span className={item.delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {formatDelta(item.delta, item.delta_pct)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sem dados no período selecionado.</p>
              )}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Ações sugeridas</h3>
            <p className="mt-2 text-sm text-slate-600">{sugestao}</p>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
