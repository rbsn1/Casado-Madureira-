"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SundayScaleAssignmentsTable } from "@/components/sunday-scale/AssignmentsTable";
import { SundayScaleSummaryCards } from "@/components/sunday-scale/SummaryCards";
import { getAuthScope } from "@/lib/authScope";
import { formatDateBR } from "@/lib/date";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  deriveUserDisplayName,
  formatScaleTime,
  hasSundayScalePortalAccess,
  isSundayScaleLeader,
  normalizeSundayScaleErrorMessage,
  SUNDAY_SCALE_CULTO_OPTIONS,
  SUNDAY_SCALE_STATUS_OPTIONS,
  SundayScaleAssignmentView,
  SundayScaleCulto,
  SundayScaleItem,
  SundayScalePresenceStatus,
  SundayScaleUserOption,
  sundayScaleCultoLabel,
  sortSundayScaleAssignments
} from "@/lib/sundayServiceScale";

type ScaleAssignmentRow = {
  id: string;
  escala_id: string;
  usuario_id: string;
  status_presenca: SundayScalePresenceStatus;
  respondido_em: string | null;
};

type AuthUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function getNextSundayDate() {
  const today = new Date();
  const next = new Date(today);
  const delta = today.getDay() === 0 ? 0 : 7 - today.getDay();
  next.setDate(today.getDate() + delta);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

async function apiFetch(path: string) {
  if (supabaseClient == null) throw new Error("Supabase não configurado.");
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa.");
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro ao consultar a API.");
  return payload;
}

export function SundayScalePortalSection() {
  const [scopeResolved, setScopeResolved] = useState(false);
  const [hasPortalAccess, setHasPortalAccess] = useState(false);
  const [canManageScale, setCanManageScale] = useState(false);
  const [loadingLeadership, setLoadingLeadership] = useState(true);
  const [loadingSelf, setLoadingSelf] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [eligibleUsers, setEligibleUsers] = useState<SundayScaleUserOption[]>([]);
  const [leadershipAssignments, setLeadershipAssignments] = useState<SundayScaleAssignmentView[]>([]);
  const [personalAssignments, setPersonalAssignments] = useState<SundayScaleAssignmentView[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [culto, setCulto] = useState<SundayScaleCulto>("DOMINGO_MANHA");
  const [dataCulto, setDataCulto] = useState(getNextSundayDate());
  const [horario, setHorario] = useState("09:00");
  const [filterCulto, setFilterCulto] = useState<string>("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<SundayScalePresenceStatus | "">("");

  const userLookup = useMemo(() => new Map(eligibleUsers.map((item) => [item.id, item])), [eligibleUsers]);

  const currentUserName = useMemo(() => {
    return deriveUserDisplayName(currentUser?.email ?? null, currentUser?.user_metadata ?? null);
  }, [currentUser]);

  const filteredEligibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return eligibleUsers;
    return eligibleUsers.filter((item) => {
      const haystack = (item.name + " " + (item.email ?? "") + " " + (item.whatsapp ?? "")).toLowerCase();
      return haystack.includes(term);
    });
  }, [eligibleUsers, userSearch]);

  const selectedUsers = useMemo(() => {
    return selectedUserIds
      .map((userId) => userLookup.get(userId))
      .filter((item): item is SundayScaleUserOption => Boolean(item));
  }, [selectedUserIds, userLookup]);

  const filteredLeadershipAssignments = useMemo(() => {
    return leadershipAssignments.filter((item) => {
      if (filterCulto && item.culto !== filterCulto) return false;
      if (filterDate && item.data !== filterDate) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      return true;
    });
  }, [leadershipAssignments, filterCulto, filterDate, filterStatus]);

  const leadershipSummary = useMemo(
    () =>
      filteredLeadershipAssignments.reduce(
        (acc, item) => {
          if (item.status === "confirmado") acc.confirmed += 1;
          else if (item.status === "nao_podera_ir") acc.declined += 1;
          else acc.pending += 1;
          return acc;
        },
        { confirmed: 0, pending: 0, declined: 0 }
      ),
    [filteredLeadershipAssignments]
  );

  const loadEligibleUsers = useCallback(async () => {
    if (!canManageScale) return;
    const payload = await apiFetch("/api/escalas-domingo/usuarios");
    setEligibleUsers((payload.users ?? []) as SundayScaleUserOption[]);
  }, [canManageScale]);

  const loadLeadershipAssignments = useCallback(async () => {
    if (supabaseClient == null || !canManageScale) {
      setLeadershipAssignments([]);
      return;
    }

    const { data: scalesData, error: scalesError } = await supabaseClient
      .from("escalas_domingo")
      .select("id, culto, data, horario, created_at")
      .order("data", { ascending: true })
      .order("horario", { ascending: true });

    if (scalesError) throw new Error(scalesError.message);

    const scales = (scalesData ?? []) as SundayScaleItem[];
    if (scales.length === 0) {
      setLeadershipAssignments([]);
      return;
    }

    const scaleById = new Map(scales.map((item) => [item.id, item]));
    const scaleIds = scales.map((item) => item.id);
    const { data: assignmentRows, error: assignmentsError } = await supabaseClient
      .from("escalas_domingo_usuarios")
      .select("id, escala_id, usuario_id, status_presenca, respondido_em")
      .in("escala_id", scaleIds);

    if (assignmentsError) throw new Error(assignmentsError.message);

    const normalized = ((assignmentRows ?? []) as ScaleAssignmentRow[])
      .map<SundayScaleAssignmentView | null>((row) => {
        const scale = scaleById.get(row.escala_id);
        if (!scale) return null;
        const user = userLookup.get(row.usuario_id);
        return {
          id: row.id,
          scaleId: row.escala_id,
          userId: row.usuario_id,
          userName: user?.name ?? ("Usuário " + row.usuario_id.slice(0, 8)),
          userEmail: user?.email ?? null,
          culto: scale.culto,
          data: scale.data,
          horario: scale.horario,
          status: row.status_presenca,
          respondidoEm: row.respondido_em
        };
      })
      .filter((item): item is SundayScaleAssignmentView => Boolean(item));

    setLeadershipAssignments(sortSundayScaleAssignments(normalized));
  }, [canManageScale, userLookup]);

  const loadPersonalAssignments = useCallback(
    async (authUser?: AuthUser | null) => {
      if (supabaseClient == null || !hasPortalAccess) {
        setPersonalAssignments([]);
        return;
      }
      const user = authUser ?? currentUser;
      if (user?.id == null) {
        setPersonalAssignments([]);
        return;
      }

      const resolvedUserName = deriveUserDisplayName(user.email ?? null, user.user_metadata ?? null);
      const { data: assignmentRows, error: assignmentsError } = await supabaseClient
        .from("escalas_domingo_usuarios")
        .select("id, escala_id, usuario_id, status_presenca, respondido_em")
        .eq("usuario_id", user.id);

      if (assignmentsError) throw new Error(assignmentsError.message);

      const normalizedRows = (assignmentRows ?? []) as ScaleAssignmentRow[];
      if (normalizedRows.length === 0) {
        setPersonalAssignments([]);
        return;
      }

      const scaleIds = normalizedRows.map((item) => item.escala_id);
      const { data: scalesData, error: scalesError } = await supabaseClient
        .from("escalas_domingo")
        .select("id, culto, data, horario, created_at")
        .in("id", scaleIds);

      if (scalesError) throw new Error(scalesError.message);

      const scaleById = new Map(((scalesData ?? []) as SundayScaleItem[]).map((item) => [item.id, item]));
      const combined = normalizedRows
        .map<SundayScaleAssignmentView | null>((row) => {
          const scale = scaleById.get(row.escala_id);
          if (!scale) return null;
          return {
            id: row.id,
            scaleId: row.escala_id,
            userId: row.usuario_id,
            userName: resolvedUserName,
            userEmail: user.email,
            culto: scale.culto,
            data: scale.data,
            horario: scale.horario,
            status: row.status_presenca,
            respondidoEm: row.respondido_em
          };
        })
        .filter((item): item is SundayScaleAssignmentView => Boolean(item))
        .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));

      setPersonalAssignments(combined);
    },
    [currentUser, hasPortalAccess]
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        if (supabaseClient == null) throw new Error("Supabase não configurado.");
        const scope = await getAuthScope();
        if (!active) return;
        const portalAccess = hasSundayScalePortalAccess(scope.roles, scope.isAdminMaster);
        const manageAccess = isSundayScaleLeader(scope.roles, scope.isAdminMaster);
        setHasPortalAccess(portalAccess);
        setCanManageScale(manageAccess);
        setScopeResolved(true);
        if (!portalAccess) {
          setLoadingLeadership(false);
          setLoadingSelf(false);
          return;
        }

        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData.user
          ? {
              id: authData.user.id,
              email: authData.user.email ?? null,
              user_metadata: (authData.user.user_metadata ?? null) as Record<string, unknown> | null
            }
          : null;
        if (!active) return;
        setCurrentUser(user);
      } catch (error) {
        if (!active) return;
        setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
        setLoadingLeadership(false);
        setLoadingSelf(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scopeResolved) return;
    if (!canManageScale) {
      setLoadingLeadership(false);
      return;
    }

    let active = true;
    setLoadingLeadership(true);
    void (async () => {
      try {
        await loadEligibleUsers();
      } catch (error) {
        if (active) {
          setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
          setLoadingLeadership(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [canManageScale, loadEligibleUsers, scopeResolved]);

  useEffect(() => {
    if (!scopeResolved) return;
    if (!canManageScale) {
      setLeadershipAssignments([]);
      setLoadingLeadership(false);
      return;
    }

    let active = true;
    setLoadingLeadership(true);
    void loadLeadershipAssignments()
      .catch((error) => {
        if (active) setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
      })
      .finally(() => {
        if (active) setLoadingLeadership(false);
      });

    return () => {
      active = false;
    };
  }, [canManageScale, loadLeadershipAssignments, scopeResolved]);

  useEffect(() => {
    if (!scopeResolved) return;
    if (!hasPortalAccess || currentUser?.id == null) {
      setLoadingSelf(false);
      return;
    }

    let active = true;
    setLoadingSelf(true);
    void loadPersonalAssignments(currentUser)
      .catch((error) => {
        if (active) setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
      })
      .finally(() => {
        if (active) setLoadingSelf(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, hasPortalAccess, loadPersonalAssignments, scopeResolved]);

  useEffect(() => {
    const client = supabaseClient;
    if (client == null || !hasPortalAccess) return;
    const channel = client
      .channel("escalas-domingo-portal")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas_domingo" }, () => {
        if (canManageScale) void loadLeadershipAssignments();
        void loadPersonalAssignments();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas_domingo_usuarios" }, () => {
        if (canManageScale) void loadLeadershipAssignments();
        void loadPersonalAssignments();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [canManageScale, hasPortalAccess, loadLeadershipAssignments, loadPersonalAssignments]);

  function toggleSelectedUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    );
  }

  async function handleCreateScale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabaseClient == null) return;

    if (selectedUserIds.length === 0) {
      setStatusMessage("Selecione ao menos um usuário cadastrado no CCM para a escala.");
      return;
    }

    setSaving(true);
    setStatusMessage("");
    try {
      const { error } = await supabaseClient.rpc("create_sunday_service_scale", {
        service_name: culto,
        service_date: dataCulto,
        service_time: horario,
        assigned_user_ids: selectedUserIds
      });
      if (error) throw error;

      setSelectedUserIds([]);
      setStatusMessage(
        "Escala criada para " + sundayScaleCultoLabel(culto) + " em " + formatDateBR(dataCulto) + " às " + formatScaleTime(horario) + "."
      );
      await loadLeadershipAssignments();
      await loadPersonalAssignments();
    } catch (error) {
      setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAssignment(row: SundayScaleAssignmentView) {
    if (supabaseClient == null) return;
    setActionLoadingId(row.id);
    setStatusMessage("");
    try {
      const { error } = await supabaseClient.from("escalas_domingo_usuarios").delete().eq("id", row.id);
      if (error) throw error;
      await loadLeadershipAssignments();
    } catch (error) {
      setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePresenceResponse(
    row: SundayScaleAssignmentView,
    nextStatus: Extract<SundayScalePresenceStatus, "confirmado" | "nao_podera_ir">
  ) {
    if (supabaseClient == null) return;
    setActionLoadingId(row.id);
    setStatusMessage("");
    try {
      const { error } = await supabaseClient.rpc("respond_sunday_service_scale", {
        assignment_id: row.id,
        next_status: nextStatus
      });
      if (error) throw error;
      if (canManageScale) await loadLeadershipAssignments();
      await loadPersonalAssignments();
    } catch (error) {
      setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
    } finally {
      setActionLoadingId(null);
    }
  }

  if (!scopeResolved) {
    return (
      <section className="card border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/50 p-6">
        <p className="text-sm text-slate-500">Carregando painel de escala...</p>
      </section>
    );
  }

  if (!hasPortalAccess) {
    return null;
  }

  return (
    <section className="space-y-6">
      <section className="card overflow-hidden border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Portal CCM</p>
            <h2 className="mt-2 text-2xl font-semibold text-emerald-950">Painel de Escala - Cultos de Domingo</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Este painel exibe apenas usuários cadastrados no CCM que foram vinculados à escala do culto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="pill bg-emerald-100 text-emerald-900">Escala no portal</span>
            {currentUserName ? <span className="pill bg-amber-100 text-amber-900">{currentUserName}</span> : null}
          </div>
        </div>
      </section>

      {statusMessage ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{statusMessage}</p>
      ) : null}

      {canManageScale ? (
        <section className="space-y-6">
          <SundayScaleSummaryCards
            confirmed={leadershipSummary.confirmed}
            pending={leadershipSummary.pending}
            declined={leadershipSummary.declined}
          />

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <form onSubmit={handleCreateScale} className="card border-emerald-100 bg-white/95 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Nova escala</p>
                  <h3 className="text-xl font-semibold text-emerald-950">Criar vínculo para o culto</h3>
                </div>
                <span className="pill bg-brand-100 text-brand-900">{selectedUserIds.length} selecionados</span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Culto</span>
                  <select
                    value={culto}
                    onChange={(event) => {
                      const nextCulto = event.target.value as SundayScaleCulto;
                      setCulto(nextCulto);
                      if (nextCulto === "DOMINGO_MANHA" && (horario === "" || horario === "19:00")) setHorario("09:00");
                      if (nextCulto === "DOMINGO_NOITE" && (horario === "" || horario === "09:00")) setHorario("19:00");
                    }}
                    className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 focus:border-brand-300 focus:outline-none"
                  >
                    {SUNDAY_SCALE_CULTO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Data</span>
                  <input type="date" value={dataCulto} onChange={(event) => setDataCulto(event.target.value)} className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 focus:border-brand-300 focus:outline-none" />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Horário</span>
                  <input type="time" value={horario} onChange={(event) => setHorario(event.target.value)} className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 focus:border-brand-300 focus:outline-none" />
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-brand-50/40 via-white to-amber-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Usuários cadastrados no CCM</p>
                    <p className="text-xs text-slate-500">Selecione apenas contas já existentes no portal. Não há digitação manual de nomes.</p>
                  </div>
                  <input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou contato" className="w-full rounded-full border border-brand-100 bg-white px-4 py-2 text-sm focus:border-brand-300 focus:outline-none sm:w-72" />
                </div>

                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {filteredEligibleUsers.map((user) => {
                    const checked = selectedUserIds.includes(user.id);
                    return (
                      <label key={user.id} className={"flex cursor-pointer items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition " + (checked ? "border-emerald-200 bg-emerald-50/80 ring-1 ring-emerald-100" : "border-brand-100 bg-white hover:border-emerald-200 hover:bg-brand-50/30")}>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">{user.email ?? "Sem e-mail visível"}</p>
                          {user.whatsapp ? <p className="mt-1 text-xs text-slate-500">{user.whatsapp}</p> : null}
                        </div>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelectedUser(user.id)} className="mt-1 h-4 w-4 rounded border-brand-200 text-emerald-600 focus:ring-emerald-300" />
                      </label>
                    );
                  })}
                  {filteredEligibleUsers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-emerald-100 bg-white/90 px-4 py-6 text-sm text-slate-600">Nenhum usuário encontrado para esse filtro.</p>
                  ) : null}
                </div>
              </div>

              {selectedUsers.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <button key={user.id} type="button" onClick={() => toggleSelectedUser(user.id)} className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-medium text-brand-900 transition hover:bg-brand-200/70">
                      {user.name} ×
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">A escala criada já nasce com todos os vinculados em status <strong>Pendente</strong>.</p>
                <button type="submit" disabled={saving} className="rounded-full bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Salvando escala..." : "Criar escala do culto"}
                </button>
              </div>
            </form>

            <aside className="card border-amber-100 bg-gradient-to-br from-white via-amber-50/25 to-emerald-50/35 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Operação</p>
              <h3 className="mt-2 text-xl font-semibold text-emerald-950">Leitura rápida da liderança</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Escolha o culto de domingo, a data e o horário do vínculo.</li>
                <li>Selecione somente usuários já cadastrados e ativos no portal CCM.</li>
                <li>Todo usuário entra na escala com status inicial <strong>Pendente</strong>.</li>
                <li>Quando o usuário responder no próprio portal, o status aparece atualizado nesta tabela.</li>
              </ul>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">Filtros disponíveis</p>
                <p className="mt-1">Culto, data e status de presença para acompanhar a escala por culto de domingo.</p>
              </div>
            </aside>
          </section>

          <section className="card border-emerald-100 bg-white/95 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Acompanhamento</p>
                <h3 className="text-xl font-semibold text-slate-900">Usuários vinculados à escala</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={filterCulto} onChange={(event) => setFilterCulto(event.target.value)} className="rounded-full border border-brand-100 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none">
                  <option value="">Todos os cultos</option>
                  {SUNDAY_SCALE_CULTO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="rounded-full border border-brand-100 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none" />
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as SundayScalePresenceStatus | "")} className="rounded-full border border-brand-100 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none">
                  {SUNDAY_SCALE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              {loadingLeadership ? (
                <p className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-6 text-sm text-slate-600">Carregando escalas e vínculos do culto...</p>
              ) : (
                <SundayScaleAssignmentsTable rows={filteredLeadershipAssignments} emptyMessage="Nenhum usuário vinculado encontrado para os filtros atuais." actionLoadingId={actionLoadingId} onRemove={handleRemoveAssignment} />
              )}
            </div>
          </section>
        </section>
      ) : null}

      <section className="card border-emerald-100 bg-gradient-to-br from-white via-emerald-50/20 to-amber-50/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Minhas presenças</p>
            <h3 className="text-xl font-semibold text-emerald-950">Escalas vinculadas ao seu usuário</h3>
          </div>
          <span className="pill bg-amber-100 text-amber-900">{personalAssignments.length} vínculo(s)</span>
        </div>

        <div className="mt-5">
          {loadingSelf ? (
            <p className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-6 text-sm text-slate-600">Carregando suas escalas vinculadas...</p>
          ) : (
            <SundayScaleAssignmentsTable
              rows={personalAssignments}
              emptyMessage="Você ainda não foi vinculado a nenhuma escala de culto de domingo."
              showNameColumn={false}
              actionLoadingId={actionLoadingId}
              onConfirm={(row) => handlePresenceResponse(row, "confirmado")}
              onDecline={(row) => handlePresenceResponse(row, "nao_podera_ir")}
            />
          )}
        </div>
      </section>
    </section>
  );
}
