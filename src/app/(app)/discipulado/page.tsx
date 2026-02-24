"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ByAcolhedorTable,
  DecisionsByOriginPanel,
  DecisionsTrendChart,
  EvangelisticImpactKpisSection,
  OperationalStatusCards,
  type ByAcolhedorRow,
  type DecisionsChartGranularity,
  type DecisionsTrendPoint,
  type EvangelisticImpactKpis,
  type EvangelisticImpactPeriod,
  type OriginImpactRow
} from "@/components/discipulado/dashboard";
import { getAuthScope } from "@/lib/authScope";
import { criticalityRank } from "@/lib/discipleshipCriticality";
import { DiscipleshipCaseSummaryItem, loadDiscipleshipCaseSummariesWithFallback } from "@/lib/discipleshipCases";
import {
  calculateMediaPorCulto,
  DecisionOrigin,
  groupByDay,
  groupByMonth,
  groupByOrigin,
  groupByYear
} from "@/lib/evangelisticImpact";
import { parseCultoOrigemCode } from "@/lib/cultoOrigem";
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

type EvangelisticDecisionRow = {
  id: string;
  created_at: string | null;
  origem: string | null;
  culto_origem?: string | null;
  cadastro_origem?: string | null;
};

type CultoRow = {
  id: string;
  tipo: string | null;
  data: string;
};

type MergedCase = DiscipleshipCaseSummaryItem & {
  created_at: string;
  last_contact_at: string | null;
  first_contact_at: string | null;
  days_since_last_contact: number;
  phone_valid: boolean;
};

const DAYS_WITHOUT_CONTACT_RISK = 7;
const IMPACT_ORIGIN_ORDER: DecisionOrigin[] = ["MANHA", "NOITE", "MJ", "QUARTA"];
const IMPACT_ORIGIN_LABELS: Record<DecisionOrigin, string> = {
  MANHA: "Culto da manhã",
  NOITE: "Culto da noite",
  MJ: "Culto do MJ",
  QUARTA: "Culto de Quarta"
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

function daysSince(timestamp: number, now: number) {
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

function inRange(timestamp: number | null, from: number, to: number) {
  if (timestamp === null) return false;
  return timestamp >= from && timestamp < to;
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

function normalizeDecisionOrigin(value: string | null | undefined): DecisionOrigin | null {
  const normalized = parseCultoOrigemCode(value);
  if (!normalized || normalized === "OUTROS") return null;
  return normalized;
}

function formatDateToYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return formatDateToYmd(date);
}

function formatDecisionDateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data inválida";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCultoTypeLabel(value: string | null | undefined, fallbackOrigin: DecisionOrigin | null) {
  if (value && value.trim()) return value.trim();
  if (!fallbackOrigin) return "Culto não informado";
  return IMPACT_ORIGIN_LABELS[fallbackOrigin];
}

function getImpactRange(period: EvangelisticImpactPeriod) {
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const fromDate = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
  const from = fromDate.getTime();
  const to = now.getTime();
  const previousFrom = from - days * 86400000;
  const previousTo = from;
  return { from, to, previousFrom, previousTo, days };
}

function isMissingCultosTableError(error: { code?: string; message: string } | null) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = error.message.toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("public.cultos") ||
    message.includes("could not find the table")
  );
}

export default function DiscipuladoDashboardPage() {
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<DashboardCards>(emptyCards);
  const [caseSummaries, setCaseSummaries] = useState<DiscipleshipCaseSummaryItem[]>([]);
  const [caseRows, setCaseRows] = useState<DiscipleshipCaseBaseRow[]>([]);
  const [contactAttempts, setContactAttempts] = useState<ContactAttemptRow[]>([]);

  const [hasAccess, setHasAccess] = useState(false);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [scopeBootstrapped, setScopeBootstrapped] = useState(false);
  const [canManageDiscipulado, setCanManageDiscipulado] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [congregationFilter, setCongregationFilter] = useState("");

  const [impactPeriod, setImpactPeriod] = useState<EvangelisticImpactPeriod>("30d");
  const [decisionsGranularity, setDecisionsGranularity] = useState<DecisionsChartGranularity>("day");
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactStatusMessage, setImpactStatusMessage] = useState("");
  const [evangelisticDecisions, setEvangelisticDecisions] = useState<EvangelisticDecisionRow[]>([]);
  const [cultos, setCultos] = useState<CultoRow[]>([]);

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
        rowsLimit: 500,
        includeExtraFields: false
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
      setLoading(false);
      return;
    }

    const summaries = summariesResult.data ?? [];
    setCaseSummaries(summaries);
    if (!summaries.length) {
      setCaseRows([]);
      setContactAttempts([]);
      setLoading(false);
      return;
    }

    const caseIds = [...new Set(summaries.map((item) => item.case_id))];

    const [casesBaseResult, attemptsResult] = await Promise.all([
      supabaseClient
        .from("discipleship_cases")
        .select("id, member_id, assigned_to, status, created_at, updated_at, criticality, days_to_confra, negative_contact_count")
        .in("id", caseIds),
      supabaseClient
        .from("contact_attempts")
        .select("case_id, outcome, created_at")
        .in("case_id", caseIds)
        .order("created_at", { ascending: true })
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

    setLoading(false);
  }, []);

  const loadEvangelisticImpact = useCallback(
    async (adminMaster: boolean, targetCongregation: string, period: EvangelisticImpactPeriod) => {
      if (!supabaseClient) return;

      setImpactLoading(true);
      setImpactStatusMessage("");

      const range = getImpactRange(period);
      const startIso = new Date(range.previousFrom).toISOString();
      const endIso = new Date(range.to).toISOString();
      const fromDateYmd = formatDateToYmd(new Date(range.previousFrom));
      const toDateYmd = formatDateToYmd(new Date(range.to));

      let decisionsQuery = supabaseClient
        .from("pessoas")
        .select("id, created_at, origem, culto_origem")
        .gte("created_at", startIso)
        .lt("created_at", endIso);

      if (adminMaster && targetCongregation) {
        decisionsQuery = decisionsQuery.eq("congregation_id", targetCongregation);
      }

      let cultosQuery = supabaseClient
        .from("cultos")
        .select("id, tipo, data")
        .gte("data", fromDateYmd)
        .lte("data", toDateYmd);

      if (adminMaster && targetCongregation) {
        cultosQuery = cultosQuery.eq("congregation_id", targetCongregation);
      }

      const [initialDecisionsResult, initialCultosResult] = await Promise.all([decisionsQuery, cultosQuery]);
      let decisionsResult: {
        data: EvangelisticDecisionRow[] | null;
        error: { code?: string; message: string } | null;
      } = {
        data: (initialDecisionsResult.data ?? null) as EvangelisticDecisionRow[] | null,
        error: initialDecisionsResult.error
      };
      let cultosResult: {
        data: CultoRow[] | null;
        error: { code?: string; message: string } | null;
      } = {
        data: (initialCultosResult.data ?? null) as CultoRow[] | null,
        error: initialCultosResult.error
      };

      if (decisionsResult.error && adminMaster && targetCongregation && decisionsResult.error.code === "42703") {
        const fallbackResult = await supabaseClient
          .from("pessoas")
          .select("id, created_at, origem")
          .gte("created_at", startIso)
          .lt("created_at", endIso);
        decisionsResult = {
          data: (fallbackResult.data ?? null) as EvangelisticDecisionRow[] | null,
          error: fallbackResult.error
        };
      }

      if (decisionsResult.error && decisionsResult.error.code === "42703") {
        const fallbackResult = await supabaseClient
          .from("pessoas")
          .select("id, created_at, origem")
          .gte("created_at", startIso)
          .lt("created_at", endIso);
        decisionsResult = {
          data: (fallbackResult.data ?? null) as EvangelisticDecisionRow[] | null,
          error: fallbackResult.error
        };

        if (adminMaster && targetCongregation && !decisionsResult.error) {
          const scopedFallbackResult = await supabaseClient
            .from("pessoas")
            .select("id, created_at, origem")
            .eq("congregation_id", targetCongregation)
            .gte("created_at", startIso)
            .lt("created_at", endIso);
          decisionsResult = {
            data: (scopedFallbackResult.data ?? null) as EvangelisticDecisionRow[] | null,
            error: scopedFallbackResult.error
          };
        }
      }

      if (cultosResult.error && adminMaster && targetCongregation && cultosResult.error.code === "42703") {
        const fallbackResult = await supabaseClient
          .from("cultos")
          .select("id, tipo, data")
          .gte("data", fromDateYmd)
          .lte("data", toDateYmd);
        cultosResult = {
          data: (fallbackResult.data ?? null) as CultoRow[] | null,
          error: fallbackResult.error
        };
      }

      const impactErrors: string[] = [];

      if (decisionsResult.error) {
        const code = decisionsResult.error.code ?? "";
        if (code === "42703" || code === "42P01") {
          impactErrors.push(
            "Dados de decisões indisponíveis no banco (cadastros/culto de origem)."
          );
        } else {
          impactErrors.push(decisionsResult.error.message);
        }
        setEvangelisticDecisions([]);
      } else {
        const decisionRows = ((decisionsResult.data ?? []) as EvangelisticDecisionRow[]).filter((item) => Boolean(item.created_at));
        setEvangelisticDecisions(decisionRows);
      }

      if (cultosResult.error) {
        if (!isMissingCultosTableError(cultosResult.error)) {
          impactErrors.push(cultosResult.error.message);
        }
        setCultos([]);
      } else {
        setCultos((cultosResult.data ?? []) as CultoRow[]);
      }

      setImpactStatusMessage(impactErrors.join(" "));
      setImpactLoading(false);
    },
    []
  );

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
        setScopeBootstrapped(true);
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

      setScopeBootstrapped(true);
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasAccess || !scopeBootstrapped) return;
    void loadDashboard(isAdminMaster, congregationFilter);
  }, [congregationFilter, hasAccess, isAdminMaster, loadDashboard, scopeBootstrapped]);

  useEffect(() => {
    if (!hasAccess || !scopeBootstrapped) return;
    void loadEvangelisticImpact(isAdminMaster, congregationFilter, impactPeriod);
  }, [congregationFilter, hasAccess, impactPeriod, isAdminMaster, loadEvangelisticImpact, scopeBootstrapped]);

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

  const impactRange = useMemo(() => getImpactRange(impactPeriod), [impactPeriod]);

  const normalizedDecisionRecords = useMemo(
    () =>
      evangelisticDecisions
        .filter((item) => Boolean(item.created_at))
        .map((item) => ({
          acceptedAt: item.created_at as string,
          origin: normalizeDecisionOrigin(item.culto_origem ?? item.origem)
        })),
    [evangelisticDecisions]
  );

  const currentDecisionRecords = useMemo(
    () =>
      normalizedDecisionRecords.filter((item) => {
        return inRange(parseTime(item.acceptedAt), impactRange.from, impactRange.to);
      }),
    [impactRange.from, impactRange.to, normalizedDecisionRecords]
  );

  const previousDecisionRecords = useMemo(
    () =>
      normalizedDecisionRecords.filter((item) => {
        return inRange(parseTime(item.acceptedAt), impactRange.previousFrom, impactRange.previousTo);
      }),
    [impactRange.previousFrom, impactRange.previousTo, normalizedDecisionRecords]
  );

  const currentCultosCount = useMemo(
    () => cultos.filter((item) => inRange(parseTime(item.data), impactRange.from, impactRange.to)).length,
    [cultos, impactRange.from, impactRange.to]
  );

  const previousCultosCount = useMemo(
    () => cultos.filter((item) => inRange(parseTime(item.data), impactRange.previousFrom, impactRange.previousTo)).length,
    [cultos, impactRange.previousFrom, impactRange.previousTo]
  );

  const impactKpis = useMemo<EvangelisticImpactKpis>(() => {
    const currentTotal = currentDecisionRecords.length;
    const previousTotal = previousDecisionRecords.length;

    const mediaAtual = calculateMediaPorCulto(currentTotal, currentCultosCount);
    const mediaAnterior = calculateMediaPorCulto(previousTotal, previousCultosCount);

    const hasCultosData = cultos.length > 0;

    const pico = (() => {
      if (hasCultosData) {
        const byCulto = new Map<string, { total: number; acceptedAt: string; origin: DecisionOrigin | null; mixed: boolean }>();
        for (const record of currentDecisionRecords) {
          const dateKey = toLocalDateKey(record.acceptedAt);
          if (!dateKey) continue;
          const originKey = record.origin ?? "SEM_ORIGEM";
          const key = `${dateKey}::${originKey}`;
          const current = byCulto.get(key) ?? { total: 0, acceptedAt: record.acceptedAt, origin: record.origin, mixed: false };
          current.total += 1;
          byCulto.set(key, current);
        }
        return [...byCulto.values()].sort((a, b) => b.total - a.total)[0] ?? null;
      }

      const byDay = new Map<string, { total: number; acceptedAt: string; origins: Set<DecisionOrigin> }>();
      for (const record of currentDecisionRecords) {
        const dateKey = toLocalDateKey(record.acceptedAt);
        if (!dateKey) continue;
        const current = byDay.get(dateKey) ?? { total: 0, acceptedAt: record.acceptedAt, origins: new Set<DecisionOrigin>() };
        current.total += 1;
        if (record.origin) current.origins.add(record.origin);
        byDay.set(dateKey, current);
      }

      const best = [...byDay.values()].sort((a, b) => b.total - a.total)[0] ?? null;
      if (!best) return null;
      const uniqueOrigins = [...best.origins];
      return {
        total: best.total,
        acceptedAt: best.acceptedAt,
        origin: uniqueOrigins.length === 1 ? uniqueOrigins[0] : null,
        mixed: uniqueOrigins.length > 1
      };
    })();

    const picoDateKey = pico ? toLocalDateKey(pico.acceptedAt) : null;
    const picoOrigin = pico?.origin ?? null;
    const cultoDoPico = hasCultosData && picoDateKey
      ? cultos.find((item) => {
          const cultoDateKey = toLocalDateKey(item.data);
          if (cultoDateKey !== picoDateKey) return false;
          const tipoNormalizado = normalizeDecisionOrigin(item.tipo);
          return picoOrigin ? tipoNormalizado === picoOrigin : true;
        }) ?? null
      : null;

    const picoCultoLabel = pico
      ? hasCultosData
        ? formatCultoTypeLabel(cultoDoPico?.tipo ?? null, pico.origin)
        : pico.mixed
          ? "Múltiplos cultos"
          : formatCultoTypeLabel(null, pico.origin)
      : null;

    return {
      aceitouJesusTotal: currentTotal,
      aceitouJesusPrevious: previousTotal,
      aceitouJesusVariationAbs: currentTotal - previousTotal,
      aceitouJesusVariationPct: computeVariationPct(currentTotal, previousTotal),
      mediaPorCulto: mediaAtual,
      mediaPorCultoPrevious: mediaAnterior,
      mediaPorCultoVariationAbs:
        mediaAtual === null || mediaAnterior === null ? null : Number((mediaAtual - mediaAnterior).toFixed(2)),
      mediaPorCultoVariationPct:
        mediaAtual === null || mediaAnterior === null || mediaAnterior <= 0
          ? null
          : ((mediaAtual - mediaAnterior) / mediaAnterior) * 100,
      pico: pico
        ? {
            total: pico.total,
            dateLabel: formatDecisionDateLabel(pico.acceptedAt),
            cultoLabel: picoCultoLabel ?? "Culto não informado"
          }
        : null
    };
  }, [cultos, currentCultosCount, currentDecisionRecords, previousCultosCount, previousDecisionRecords]);

  const groupedCurrentDecisions = useMemo(() => {
    if (decisionsGranularity === "month") return groupByMonth(currentDecisionRecords);
    if (decisionsGranularity === "year") return groupByYear(currentDecisionRecords);
    return groupByDay(currentDecisionRecords);
  }, [currentDecisionRecords, decisionsGranularity]);

  const decisionsTrendData = useMemo<DecisionsTrendPoint[]>(
    () =>
      groupedCurrentDecisions.map((point, index) => {
        const previous = index > 0 ? groupedCurrentDecisions[index - 1] : null;
        const variationAbs = previous ? point.total - previous.total : null;
        return {
          key: point.key,
          label: point.label,
          total: point.total,
          previousTotal: previous?.total ?? null,
          variationAbs,
          variationPct: previous ? computeVariationPct(point.total, previous.total) : null
        };
      }),
    [groupedCurrentDecisions]
  );

  const originImpactRows = useMemo<OriginImpactRow[]>(() => {
    const currentByOrigin = new Map(groupByOrigin(currentDecisionRecords).map((item) => [item.origin, item.total]));
    const previousByOrigin = new Map(groupByOrigin(previousDecisionRecords).map((item) => [item.origin, item.total]));
    const currentTotal = currentDecisionRecords.length;

    return IMPACT_ORIGIN_ORDER.map((origin) => {
      const current = currentByOrigin.get(origin) ?? 0;
      const previous = previousByOrigin.get(origin) ?? 0;
      return {
        origin,
        label: IMPACT_ORIGIN_LABELS[origin],
        current,
        previous,
        sharePct: currentTotal > 0 ? (current / currentTotal) * 100 : 0,
        variationAbs: current - previous,
        variationPct: computeVariationPct(current, previous)
      };
    });
  }, [currentDecisionRecords, previousDecisionRecords]);

  const activeCases = useMemo(
    () => mergedCases.filter((item) => item.status !== "concluido"),
    [mergedCases]
  );

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
        <div className="-mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="flex min-w-max items-center gap-2">
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
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      {loading ? <div className="discipulado-panel p-5 text-sm text-slate-600">Carregando indicadores...</div> : null}

      <OperationalStatusCards cards={cards} />

      {impactLoading ? <div className="discipulado-panel p-5 text-sm text-slate-600">Carregando impacto evangelístico...</div> : null}

      {impactStatusMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{impactStatusMessage}</p>
      ) : null}

      <EvangelisticImpactKpisSection period={impactPeriod} onPeriodChange={setImpactPeriod} metrics={impactKpis} />

      <DecisionsTrendChart
        data={decisionsTrendData}
        granularity={decisionsGranularity}
        onGranularityChange={setDecisionsGranularity}
      />

      <DecisionsByOriginPanel rows={originImpactRows} />

      <section className="space-y-4" aria-label="Gestão complementar">
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
      </section>
    </div>
  );
}
