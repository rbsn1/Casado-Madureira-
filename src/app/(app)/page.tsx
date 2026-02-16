"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/cards/StatCard";
import { InsightBarChart } from "@/components/charts/InsightBarChart";
import { MonthlyRegistrationsChart } from "@/components/charts/MonthlyRegistrationsChart";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatDate, getPeriodRange, formatDelta } from "@/lib/dashboard-utils";

export default function DashboardPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  const {
    kpi,
    origem,
    igrejas,
    bairros,
    crescimentoBairros,
    crescimentoIgrejas,
    statusMessage,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    anosDisponiveis,
    anoSelecionado,
    setAnoSelecionado,
    mensal,
    isAdminMaster,
    congregationFilter,
    setCongregationFilter,
    congregations,
    discipleshipCards,
    userRoles
  } = useDashboardData();

  function handleMonthClick(year: number, month: number) {
    const monthValue = String(month).padStart(2, "0");
    router.push(`/cadastros?mes=${year}-${monthValue}`);
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

  const showEmptyPeriodHint = useMemo(() => {
    const range = getPeriodRange(period, customStart, customEnd);
    if (!range.start || !range.end) return false;
    return kpi.totalCasados === 0 && kpi.baseTotalCasados > 0;
  }, [period, customStart, customEnd, kpi.totalCasados, kpi.baseTotalCasados]);

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
                className={`rounded-full border border-brand-100 px-3 py-1 text-sm font-medium transition ${period === label
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

      {showEmptyPeriodHint ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este período não tem cadastros, mas existem <span className="font-semibold">{kpi.baseTotalCasados}</span> na base.
          Se você importou uma planilha com datas antigas, use <span className="font-semibold">Personalizado</span> ou selecione o{" "}
          <span className="font-semibold">ano</span> no gráfico mensal.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cadastros no período" value={kpi.totalCasados} hint="No período selecionado" tone="emerald" />
        <StatCard label="Base total" value={kpi.baseTotalCasados} hint="Todos os cadastros" tone="emerald" />
        <StatCard label="Culto da manhã" value={kpi.cultoManha} hint="Origem: manhã" tone="sky" />
        <StatCard label="Culto da noite" value={kpi.cultoNoite} hint="Origem: noite" tone="amber" />
      </div>

      {userRoles.includes("DISCIPULADOR") ? (
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
