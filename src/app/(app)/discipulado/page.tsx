"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ByAcolhedorTable,
  EntryVsProgressChart,
  ExecutiveKpiRow,
  OperationalStatusCards,
  RecommendedActionsPanel,
  RiskNowPanel,
  type ByAcolhedorRow,
  type EntryVsProgressPoint,
  type ExecutiveKpiModel,
  type ExecutiveKpiPeriod,
  type RecommendedActionItem,
  type RiskNowItem
} from "@/components/discipulado/dashboard";
import { getAuthScope } from "@/lib/authScope";
import { criticalityRank } from "@/lib/discipleshipCriticality";
import { DiscipleshipCaseSummaryItem, loadDiscipleshipCaseSummariesWithFallback } from "@/lib/discipleshipCases";
import { supabaseClient } from "@/lib/supabaseClient";

type DashboardCards = {
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

type DiscipleshipCaseBaseRow = {
  id: string;
  member_id: string;
  assigned_to: string | null;
  status: "pendente_matricula" | "em_discipulado" | "concluido" | "pausado";
  created_at: string;
  updated_at: string;
  criticality: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  days_to_confra: number | null;
  negative_contact_count: number;
};

type ContactAttemptRow = {
  case_id: string;
  outcome: string;
  created_at: string;
};

type ProgressEventRow = {
  case_id: string;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  updated_at: string;
};

type MergedCase = DiscipleshipCaseSummaryItem & {
  created_at: string;
  last_contact_at: string | null;
  first_contact_at: string | null;
  days_since_last_contact: number;
  phone_valid: boolean;
};

const DAYS_WITHOUT_CONTACT_RISK = 7;
const DAYS_OVERDUE_FALLBACK = 3;
const DAYS_TO_DEADLINE_ALERT = 7;
const CHART_WEEKS = 12;

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

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function startOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(input: Date) {
  const date = startOfDay(input);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function daysSince(timestamp: number, now: number) {
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

function inRange(timestamp: number | null, from: number, to: number) {
  if (timestamp === null) return false;
  return timestamp >= from && timestamp < to;
}

function formatDurationShort(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) return null;
  const hours = durationMs / 3600000;
  if (hours < 24) {
    const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
    return `${rounded}h`;
  }
  const days = hours / 24;
  const roundedDays = days >= 10 ? Math.round(days) : Number(days.toFixed(1));
  return `${roundedDays}d`;
}

function formatWeekLabel(timestamp: number) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function sanitizePhone(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function isPhoneValid(value: string | null) {
  const digits = sanitizePhone(value);
  return digits.length >= 10 && digits.length <= 14;
}

function computeVariationPct(currentValue: number, previousValue: number) {
  if (previousValue <= 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

export default function DiscipuladoDashboardPage() {
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<DashboardCards>(emptyCards);
  const [caseSummaries, setCaseSummaries] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [caseRows, setCaseRows] = useState<DiscipleshipCaseBaseRow[]>([]);
  const [contactAttempts, setContactAttempts] = useState<ContactAttemptRow[]>([]);
  const [progressEvents, setProgressEvents] = useState<ProgressEventRow[]>([]);

  const [hasAccess, setHasAccess] = useState(false);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [canManageDiscipulado, setCanManageDiscipulado] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [congregationFilter, setCongregationFilter] = useState("");

  const [kpiPeriod, setKpiPeriod] = useState<ExecutiveKpiPeriod>("7d");

  const loadDashboard = useCallback(async (adminMaster: boolean, targetCongregation: string) => {
    if (!supabaseClient) return;

    setStatusMessage("");
    setLoading(true);

    const targetCongregationId = adminMaster ? targetCongregation || null : null;

    const [dashboardResult, summariesResult] = await Promise.all([
      supabaseClient.rpc("get_discipleship_dashboard", {
        stale_days: 14,
        target_congregation_id: targetCongregationId
      }),
      loadDiscipleshipCaseSummariesWithFallback({
        targetCongregationId,
        rowsLimit: 500
      })
    ]);

    const { data: dashboardData, error: dashboardError } = dashboardResult;
    if (dashboardError) {
      setStatusMessage(normalizeDashboardErrorMessage(dashboardError.message));
    } else {
      const payload = (dashboardData ?? {}) as { cards?: DashboardCards };
      setCards(payload.cards ?? emptyCards);
    }

    if (summariesResult.errorMessage) {
      setStatusMessage((prev) => prev || summariesResult.errorMessage);
      setCaseSummaries([]);
      setCaseRows([]);
      setContactAttempts([]);
      setProgressEvents([]);
      setLoading(false);
      return;
    }

    const summaries = summariesResult.data ?? [];
    setCaseSummaries(summaries);
    if (!summaries.length) {
      setCaseRows([]);
      setContactAttempts([]);
      setProgressEvents([]);
      setLoading(false);
      return;
    }

    const caseIds = [...new Set(summaries.map((item) => item.case_id))];

    const [casesBaseResult, attemptsResult, progressResult] = await Promise.all([
      supabaseClient
        .from("discipleship_cases")
        .select("id, member_id, assigned_to, status, created_at, updated_at, criticality, days_to_confra, negative_contact_count")
        .in("id", caseIds),
      supabaseClient
        .from("contact_attempts")
        .select("case_id, outcome, created_at")
        .in("case_id", caseIds)
        .order("created_at", { ascending: true }),
      supabaseClient
        .from("discipleship_progress")
        .select("case_id, status, updated_at")
        .in("case_id", caseIds)
    ]);

    if (casesBaseResult.error) {
      setStatusMessage((prev) => prev || casesBaseResult.error?.message || "Falha ao carregar casos.");
      setCaseRows([]);
    } else {
      const baseRows = (casesBaseResult.data ?? []) as DiscipleshipCaseBaseRow[];
      setCaseRows(baseRows);
    }

    if (attemptsResult.error) {
      const message = String(attemptsResult.error.message ?? "");
      if (!message.includes("contact_attempts") && attemptsResult.error.code !== "42P01") {
        setStatusMessage((prev) => prev || attemptsResult.error?.message || "Falha ao carregar tentativas de contato.");
      }
      setContactAttempts([]);
    } else {
      setContactAttempts((attemptsResult.data ?? []) as ContactAttemptRow[]);
    }

    if (progressResult.error) {
      setStatusMessage((prev) => prev || progressResult.error?.message || "Falha ao carregar progresso.");
      setProgressEvents([]);
    } else {
      setProgressEvents((progressResult.data ?? []) as ProgressEventRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!supabaseClient) {
        if (active) {
          setStatusMessage("Supabase não configurado.");
          setLoading(false);
        }
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;

      const hasDiscipuladorRole = scope.roles.includes("DISCIPULADOR");
      const hasAdminDiscipuladoRole = scope.roles.includes("ADMIN_DISCIPULADO");
      const allowed = hasDiscipuladorRole || hasAdminDiscipuladoRole || scope.isAdminMaster;

      setHasAccess(allowed);
      setIsAdminMaster(scope.isAdminMaster);
      setCanManageDiscipulado(hasAdminDiscipuladoRole || scope.isAdminMaster);
      setCanCreateNovoConvertido(
        scope.isAdminMaster ||
          scope.roles.includes("ADMIN_DISCIPULADO") ||
          scope.roles.includes("DISCIPULADOR") ||
          scope.roles.includes("SM_DISCIPULADO") ||
          scope.roles.includes("SECRETARIA_DISCIPULADO")
      );

      if (!allowed) {
        setLoading(false);
        return;
      }

      if (scope.isAdminMaster) {
        const { data: congregationRows } = await supabaseClient
          .from("congregations")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (active && congregationRows) {
          setCongregations(
            congregationRows
              .map((row) => ({ id: String(row.id), name: String(row.name ?? "Congregação") }))
              .filter((row) => row.id)
          );
        }
      }

      await loadDashboard(scope.isAdminMaster, "");
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

  const mergedCases = useMemo<MergedCase[]>(() => {
    const now = Date.now();

    const attemptsByCase = new Map<string, { first: number | null; last: number | null }>();
    for (const attempt of contactAttempts) {
      const timestamp = parseTime(attempt.created_at);
      if (timestamp === null) continue;
      const current = attemptsByCase.get(attempt.case_id) ?? { first: null, last: null };
      if (current.first === null || timestamp < current.first) current.first = timestamp;
      if (current.last === null || timestamp > current.last) current.last = timestamp;
      attemptsByCase.set(attempt.case_id, current);
    }

    const baseByCaseId = new Map(caseRows.map((row) => [row.id, row]));

    return caseSummaries.map((summary) => {
      const base = baseByCaseId.get(summary.case_id);
      const createdAt = base?.created_at ?? summary.updated_at;
      const fallbackCreated = parseTime(createdAt) ?? now;
      const contactStats = attemptsByCase.get(summary.case_id);
      const firstContact = contactStats?.first ?? null;
      const lastContact = contactStats?.last ?? null;
      const referenceTimestamp = lastContact ?? fallbackCreated;

      return {
        ...summary,
        status: base?.status ?? summary.status,
        assigned_to: base?.assigned_to ?? summary.assigned_to,
        criticality: base?.criticality ?? summary.criticality,
        days_to_confra: base?.days_to_confra ?? summary.days_to_confra,
        negative_contact_count: base?.negative_contact_count ?? summary.negative_contact_count,
        created_at: createdAt,
        first_contact_at: firstContact ? new Date(firstContact).toISOString() : null,
        last_contact_at: lastContact ? new Date(lastContact).toISOString() : null,
        days_since_last_contact: daysSince(referenceTimestamp, now),
        phone_valid: isPhoneValid(summary.member_phone)
      } satisfies MergedCase;
    });
  }, [caseRows, caseSummaries, contactAttempts]);

  const periodRange = useMemo(() => {
    const now = new Date();
    if (kpiPeriod === "today") {
      const from = startOfDay(now).getTime();
      const to = now.getTime();
      const previousFrom = from - 86400000;
      const previousTo = from;
      return { from, to, previousFrom, previousTo };
    }

    const days = kpiPeriod === "7d" ? 7 : 30;
    const to = now.getTime();
    const from = to - days * 86400000;
    const previousFrom = from - days * 86400000;
    const previousTo = from;
    return { from, to, previousFrom, previousTo };
  }, [kpiPeriod]);

  const activeCases = useMemo(
    () => mergedCases.filter((item) => item.status !== "concluido"),
    [mergedCases]
  );

  const kpiMetrics = useMemo<ExecutiveKpiModel>(() => {
    const novosNoPeriodo = mergedCases.filter((item) => inRange(parseTime(item.created_at), periodRange.from, periodRange.to));

    const novosPeriodoAnterior = mergedCases.filter((item) =>
      inRange(parseTime(item.created_at), periodRange.previousFrom, periodRange.previousTo)
    );

    const firstContactDurations = mergedCases
      .filter((item) => {
        const firstContact = parseTime(item.first_contact_at);
        return inRange(firstContact, periodRange.from, periodRange.to);
      })
      .map((item) => {
        const firstContact = parseTime(item.first_contact_at) ?? 0;
        const createdAt = parseTime(item.created_at) ?? firstContact;
        return Math.max(0, firstContact - createdAt);
      });

    const averageFirstContactMs =
      firstContactDurations.length > 0
        ? firstContactDurations.reduce((acc, value) => acc + value, 0) / firstContactDurations.length
        : null;

    const semContatoSeteDias = activeCases.filter((item) => item.days_since_last_contact >= DAYS_WITHOUT_CONTACT_RISK).length;

    // Fallback determinístico para atraso quando não existe next_action_due_at: sem contato >= 3 dias.
    const atrasados = activeCases.filter((item) => item.days_since_last_contact >= DAYS_OVERDUE_FALLBACK).length;

    return {
      novosConvertidos: novosNoPeriodo.length,
      previousNovosConvertidos: novosPeriodoAnterior.length,
      variationPct: computeVariationPct(novosNoPeriodo.length, novosPeriodoAnterior.length),
      tempoMedioPrimeiroContato: formatDurationShort(averageFirstContactMs),
      semContatoSeteDias,
      atrasados
    };
  }, [activeCases, mergedCases, periodRange]);

  const entryVsProgressSeries = useMemo<EntryVsProgressPoint[]>(() => {
    const now = new Date();
    const firstBucketDate = startOfWeek(new Date(now.getTime() - (CHART_WEEKS - 1) * 7 * 86400000));
    const firstBucketMs = firstBucketDate.getTime();

    const buckets: EntryVsProgressPoint[] = [];

    for (let index = 0; index < CHART_WEEKS; index += 1) {
      const from = firstBucketMs + index * 7 * 86400000;
      const to = from + 7 * 86400000;

      const novos = mergedCases.filter((item) => {
        const createdAt = parseTime(item.created_at);
        return inRange(createdAt, from, to);
      }).length;

      // Proxy para avanço de etapa sem trilha histórica dedicada:
      // usa atualizações de progresso com status != nao_iniciado.
      const avancaram = progressEvents.filter((event) => {
        if (event.status === "nao_iniciado") return false;
        return inRange(parseTime(event.updated_at), from, to);
      }).length;

      buckets.push({
        key: `w-${index}`,
        label: formatWeekLabel(from),
        novos,
        avancaram
      });
    }

    return buckets;
  }, [mergedCases, progressEvents]);

  const riskItems = useMemo<RiskNowItem[]>(() => {
    const semContatoRecente = activeCases.filter((item) => item.days_since_last_contact >= DAYS_WITHOUT_CONTACT_RISK).length;
    const telefoneInvalido = activeCases.filter((item) => !item.phone_valid).length;
    const atrasados = activeCases.filter((item) => item.days_since_last_contact >= DAYS_OVERDUE_FALLBACK).length;
    const proximosLimite = activeCases.filter(
      (item) => item.days_to_confra !== null && item.days_to_confra >= 0 && item.days_to_confra <= DAYS_TO_DEADLINE_ALERT
    ).length;

    const items: RiskNowItem[] = [
      {
        id: "sem-contato",
        title: "Sem contato recente (7+ dias)",
        subtitle: "Casos ativos sem interação registrada.",
        count: semContatoRecente,
        href: "/discipulado/fila",
        cta: "Ver lista",
        severity: semContatoRecente > 0 ? "high" : "low"
      },
      {
        id: "telefone-invalido",
        title: "Telefone inválido",
        subtitle: "Cadastro sem número válido para contato.",
        count: telefoneInvalido,
        href: "/discipulado/convertidos",
        cta: "Verificar cadastros",
        severity: telefoneInvalido > 0 ? "high" : "low"
      },
      {
        id: "atrasados",
        title: "Atrasados",
        subtitle: "Casos fora do prazo interno de acompanhamento.",
        count: atrasados,
        href: "/discipulado/fila",
        cta: "Priorizar casos",
        severity: atrasados > 0 ? "medium" : "low"
      },
      {
        id: "proximos-limite",
        title: "Próximos da data limite (0-7 dias)",
        subtitle: "Confraternização próxima sem evolução suficiente.",
        count: proximosLimite,
        href: "/discipulado/fila",
        cta: "Acompanhar agora",
        severity: proximosLimite > 0 ? "medium" : "low"
      }
    ];

    return items.sort((a, b) => b.count - a.count);
  }, [activeCases]);

  const byAcolhedor = useMemo<ByAcolhedorRow[]>(() => {
    const grouped = new Map<string, ByAcolhedorRow>();

    for (const item of activeCases) {
      const groupId = item.assigned_to ?? "nao-atribuido";
      const current = grouped.get(groupId) ?? {
        id: groupId,
        name: item.discipulador_email ?? "A definir",
        total: 0,
        criticos: 0,
        semContatoSeteDias: 0
      };

      current.total += 1;
      if (criticalityRank(item.criticality) >= 3) current.criticos += 1;
      if (item.days_since_last_contact >= DAYS_WITHOUT_CONTACT_RISK) current.semContatoSeteDias += 1;

      if (!item.discipulador_email && current.name === "A definir") {
        current.name = "A definir";
      }

      grouped.set(groupId, current);
    }

    return [...grouped.values()].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.criticos - a.criticos;
    });
  }, [activeCases]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const items: RecommendedActionItem[] = [];

    const phoneInvalidCount = activeCases.filter((item) => !item.phone_valid).length;
    const noContactCount = activeCases.filter((item) => item.days_since_last_contact >= DAYS_WITHOUT_CONTACT_RISK).length;
    const overdueCount = activeCases.filter((item) => item.days_since_last_contact >= DAYS_OVERDUE_FALLBACK).length;

    if (phoneInvalidCount > 0) {
      items.push({
        id: "fix-phones",
        title: "Verificar cadastros sem telefone válido",
        subtitle: "Padronizar WhatsApp para reduzir falha de contato.",
        count: phoneInvalidCount,
        href: "/discipulado/convertidos",
        cta: "Ajustar contatos"
      });
    }

    if (noContactCount > 0) {
      items.push({
        id: "prioritize-no-contact",
        title: "Priorizar contato dos sem contato",
        subtitle: "Organizar mutirão de retorno para casos estagnados.",
        count: noContactCount,
        href: "/discipulado/fila",
        cta: "Ver casos críticos"
      });
    }

    const totalCriticos = byAcolhedor.reduce((sum, row) => sum + row.criticos, 0);
    const topAcolhedor = byAcolhedor[0];
    if (topAcolhedor && totalCriticos > 0 && topAcolhedor.criticos / totalCriticos >= 0.45 && topAcolhedor.criticos >= 2) {
      items.push({
        id: "rebalance-owners",
        title: "Reatribuir casos acumulados",
        subtitle: `Concentração alta em ${topAcolhedor.name}.`,
        count: topAcolhedor.criticos,
        href: "/discipulado/admin",
        cta: "Rebalancear equipe"
      });
    }

    if (overdueCount > 0) {
      items.push({
        id: "resolve-overdue",
        title: "Reduzir casos atrasados",
        subtitle: "Atualizar próximo passo de cada acompanhamento.",
        count: overdueCount,
        href: "/discipulado/fila",
        cta: "Executar plano"
      });
    }

    const latestPoint = entryVsProgressSeries[entryVsProgressSeries.length - 1];
    if (latestPoint && latestPoint.novos - latestPoint.avancaram > 0) {
      items.push({
        id: "entry-vs-progress-gap",
        title: "Entrada maior que progresso",
        subtitle: "A entrada da semana está acima do avanço de etapa.",
        count: latestPoint.novos - latestPoint.avancaram,
        href: "/discipulado/fila",
        cta: "Acompanhar gargalo"
      });
    }

    return items.slice(0, 4);
  }, [activeCases, byAcolhedor, entryVsProgressSeries]);

  const stageConversion = useMemo(() => {
    if (!mergedCases.length) return [] as Array<{ label: string; value: number }>;

    const pendente = mergedCases.filter((item) => item.status === "pendente_matricula").length;
    const emDiscipulado = mergedCases.filter((item) => item.status === "em_discipulado").length;
    const pausados = mergedCases.filter((item) => item.status === "pausado").length;
    const concluidos = mergedCases.filter((item) => item.status === "concluido").length;

    return [
      { label: "Pendente", value: pendente },
      { label: "Em discipulado", value: emDiscipulado },
      { label: "Pausados", value: pausados },
      { label: "Concluídos", value: concluidos }
    ];
  }, [mergedCases]);
  const stageMax = useMemo(() => Math.max(...stageConversion.map((entry) => entry.value), 1), [stageConversion]);

  if (!hasAccess) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-2xl font-semibold text-sky-950">Painel Discipulado</h2>
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

      {loading ? <div className="discipulado-panel p-5 text-sm text-slate-600">Carregando indicadores...</div> : null}

      <OperationalStatusCards cards={cards} />

      <ExecutiveKpiRow period={kpiPeriod} onPeriodChange={setKpiPeriod} metrics={kpiMetrics} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <EntryVsProgressChart data={entryVsProgressSeries} />
        <div className="space-y-4">
          <RiskNowPanel items={riskItems} />
          <RecommendedActionsPanel items={recommendedActions} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
        <ByAcolhedorTable rows={byAcolhedor} />

        <section className="discipulado-panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-900">Conversão por etapa</h3>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">Resumo</span>
          </div>

          {stageConversion.some((item) => item.value > 0) ? (
            <div className="mt-3 space-y-3">
              {stageConversion.map((item) => {
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-sky-600" style={{ width: `${(item.value / stageMax) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-sm text-slate-500">
              Sem dados no período.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
