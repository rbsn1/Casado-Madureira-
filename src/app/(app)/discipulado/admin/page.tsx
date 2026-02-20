"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { formatDateBR } from "@/lib/date";

type Congregation = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

type ModuleItem = {
  id: string;
  congregation_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
};

type ModuleDraft = {
  title: string;
  description: string;
  sort_order: string;
};

type UserRole = {
  role: string;
  active: boolean;
  congregation_id: string | null;
};

type UserItem = {
  id: string;
  email: string | null;
  created_at: string;
  roles: UserRole[];
  whatsapp?: string | null;
};

const DISCIPULADO_USER_ROLES = [
  "ADMIN_DISCIPULADO",
  "DISCIPULADOR",
  "SM_DISCIPULADO",
  "SECRETARIA_DISCIPULADO"
] as const;
type DiscipuladoUserRole = (typeof DISCIPULADO_USER_ROLES)[number];

function getDiscipuladoRoleLabel(role: string) {
  if (role === "ADMIN_DISCIPULADO") return "Admin Discipulado";
  if (role === "SECRETARIA_DISCIPULADO") return "Secretária Discipulado (Cadastro)";
  if (role === "SM_DISCIPULADO") return "SM Discipulado (Cadastro)";
  return "Discipulador";
}

export default function DiscipuladoAdminPage() {
  const lastLoadedCongregationRef = useRef<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [managerCongregationId, setManagerCongregationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [congregationStatusMessage, setCongregationStatusMessage] = useState("");
  const [congregationSuccessMessage, setCongregationSuccessMessage] = useState("");
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [congregationFilter, setCongregationFilter] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, ModuleDraft>>({});
  const [openCasesCount, setOpenCasesCount] = useState(0);
  const [totalCasesCount, setTotalCasesCount] = useState(0);
  const [discipleshipUsers, setDiscipleshipUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStatusMessage, setUserStatusMessage] = useState("");
  const [userSuccessMessage, setUserSuccessMessage] = useState("");
  const [newUserGlobalScope, setNewUserGlobalScope] = useState(false);
  const [newUser, setNewUser] = useState({
    role: "DISCIPULADOR" as DiscipuladoUserRole,
    email: "",
    password: "",
    whatsapp: "",
    congregation_id: ""
  });
  const [newCongregation, setNewCongregation] = useState({
    name: "",
    slug: ""
  });
  const [newModule, setNewModule] = useState({
    congregation_id: "",
    title: "",
    description: "",
    sort_order: "1"
  });
  const [confraternizationAtDraft, setConfraternizationAtDraft] = useState("");
  const [calendarStatusMessage, setCalendarStatusMessage] = useState("");
  const [calendarSuccessMessage, setCalendarSuccessMessage] = useState("");

  const congregationNameById = useMemo(() => {
    return congregations.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
  }, [congregations]);

  const activeModulesCount = useMemo(
    () => modules.filter((item) => item.is_active).length,
    [modules]
  );

  const activeCongregations = useMemo(
    () => congregations.filter((item) => item.is_active),
    [congregations]
  );
  const selectableCongregations = useMemo(
    () => (activeCongregations.length ? activeCongregations : congregations),
    [activeCongregations, congregations]
  );

  const filteredDiscipleshipUsers = useMemo(
    () =>
      discipleshipUsers.filter((user) => {
        const discipuladoRole = user.roles.find((role) =>
          DISCIPULADO_USER_ROLES.includes(role.role as DiscipuladoUserRole)
        );
        if (!discipuladoRole) return false;
        if (!congregationFilter) return true;
        return discipuladoRole.congregation_id === congregationFilter;
      }),
    [congregationFilter, discipleshipUsers]
  );

  const activeDiscipleshipUsers = useMemo(
    () =>
      filteredDiscipleshipUsers.filter((user) =>
        user.roles.some(
          (role) => DISCIPULADO_USER_ROLES.includes(role.role as DiscipuladoUserRole) && role.active
        )
      ).length,
    [filteredDiscipleshipUsers]
  );
  const tenantStats = useMemo(() => {
    const total = congregations.length;
    const active = congregations.filter((item) => item.is_active).length;
    const inactive = Math.max(0, total - active);
    const activeRatio = total ? Math.round((active / total) * 100) : 0;
    const newest = [...congregations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return { total, active, inactive, activeRatio, newest };
  }, [congregations]);

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!supabaseClient) throw new Error("Supabase não configurado.");
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada.");
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {})
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Erro na requisição.");
    }
    return payload;
  }, []);

  const loadCongregations = useCallback(async () => {
    const data = await apiFetch("/api/admin/congregations");
    const congregationItems = ((data.congregations ?? []) as Congregation[]).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setCongregations(congregationItems);
    return congregationItems;
  }, [apiFetch]);

  const loadDiscipleshipUsers = useCallback(async (targetCongregation?: string) => {
    setUsersLoading(true);
    setUserStatusMessage("");
    try {
      const responses = await Promise.all(
        DISCIPULADO_USER_ROLES.map(async (role) => {
          const query = new URLSearchParams({
            role,
            page: "1",
            perPage: "200"
          });
          if (targetCongregation) {
            query.set("congregationId", targetCongregation);
          }
          return apiFetch(`/api/admin/users?${query.toString()}`);
        })
      );

      const usersById = new Map<string, UserItem>();
      responses.forEach((response) => {
        const roleUsers = (response.users ?? []) as UserItem[];
        roleUsers.forEach((user) => {
          const existing = usersById.get(user.id);
          if (!existing) {
            usersById.set(user.id, user);
            return;
          }
          const roleMap = new Map<string, UserRole>();
          [...existing.roles, ...user.roles].forEach((role) => {
            roleMap.set(`${role.role}:${role.congregation_id ?? ""}`, role);
          });
          usersById.set(user.id, { ...existing, roles: Array.from(roleMap.values()) });
        });
      });

      const users = Array.from(usersById.values()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
      setDiscipleshipUsers(users);
    } catch (error) {
      setUserStatusMessage((error as Error).message);
    } finally {
      setUsersLoading(false);
    }
  }, [apiFetch]);

  const loadPanelData = useCallback(async (targetCongregation: string) => {
    if (!supabaseClient) return;
    setStatusMessage("");
    setSuccessMessage("");
    setCalendarStatusMessage("");
    setCalendarSuccessMessage("");

    let modulesQuery = supabaseClient
      .from("discipleship_modules")
      .select("id, congregation_id, title, description, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    let openCasesQuery = supabaseClient
      .from("discipleship_cases")
      .select("*", { count: "exact", head: true })
      .in("status", ["em_discipulado", "pausado"]);

    let totalCasesQuery = supabaseClient
      .from("discipleship_cases")
      .select("*", { count: "exact", head: true });

    let calendarQuery = Promise.resolve({
      data: null as { confraternization_at: string } | null,
      error: null as { message?: string } | null
    });

    if (targetCongregation) {
      modulesQuery = modulesQuery.eq("congregation_id", targetCongregation);
      openCasesQuery = openCasesQuery.eq("congregation_id", targetCongregation);
      totalCasesQuery = totalCasesQuery.eq("congregation_id", targetCongregation);
      calendarQuery = (supabaseClient
        .from("discipleship_calendar")
        .select("confraternization_at")
        .eq("congregation_id", targetCongregation)
        .maybeSingle() as unknown) as Promise<{
        data: { confraternization_at: string } | null;
        error: { message?: string } | null;
      }>;
    }

    const [
      { data: modulesData, error: modulesError },
      { count: openCases, error: openCasesError },
      { count: totalCases, error: totalCasesError },
      { data: calendarData, error: calendarError }
    ] = await Promise.all([modulesQuery, openCasesQuery, totalCasesQuery, calendarQuery]);

    if (modulesError || openCasesError || totalCasesError || calendarError) {
      setStatusMessage(
        modulesError?.message ??
          openCasesError?.message ??
          totalCasesError?.message ??
          calendarError?.message ??
          "Falha ao carregar painel de admin."
      );
      return;
    }

    const moduleItems = (modulesData ?? []) as ModuleItem[];
    setModules(moduleItems);
    setModuleDrafts(
      moduleItems.reduce<Record<string, ModuleDraft>>((acc, item) => {
        acc[item.id] = {
          title: item.title,
          description: item.description ?? "",
          sort_order: String(item.sort_order)
        };
        return acc;
      }, {})
    );
    setOpenCasesCount(openCases ?? 0);
    setTotalCasesCount(totalCases ?? 0);

    const confraIso = calendarData?.confraternization_at ?? "";
    if (!confraIso) {
      setConfraternizationAtDraft("");
      return;
    }
    const local = new Date(confraIso);
    const timezoneOffset = local.getTimezoneOffset() * 60000;
    const localInput = new Date(local.getTime() - timezoneOffset).toISOString().slice(0, 16);
    setConfraternizationAtDraft(localInput);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!supabaseClient) {
        if (active) {
          setLoading(false);
          setStatusMessage("Supabase não configurado.");
        }
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;

      const hasAdminDiscipuladoRole = scope.roles.includes("ADMIN_DISCIPULADO");
      const isScopeGlobalAdmin =
        scope.isAdminMaster || (hasAdminDiscipuladoRole && !scope.congregationId);
      setHasAccess(hasAdminDiscipuladoRole);
      setIsGlobalAdmin(isScopeGlobalAdmin);
      setManagerCongregationId(scope.congregationId ?? null);

      if (!hasAdminDiscipuladoRole) {
        setLoading(false);
        return;
      }

      let congregationItems: Congregation[] = [];
      try {
        congregationItems = await loadCongregations();
      } catch (error) {
        if (!active) return;
        setStatusMessage((error as Error).message);
        setLoading(false);
        return;
      }

      if (!active) return;

      const scopeCongregation = scope.congregationId ?? "";
      const firstActiveCongregation =
        congregationItems.find((item) => item.is_active)?.id ?? congregationItems[0]?.id ?? "";
      const defaultCongregation = isScopeGlobalAdmin ? "" : scopeCongregation || firstActiveCongregation;

      setCongregationFilter(defaultCongregation);
      setNewModule((prev) => ({
        ...prev,
        congregation_id: defaultCongregation || congregationItems[0]?.id || ""
      }));
      setNewUser((prev) => ({
        ...prev,
        congregation_id: defaultCongregation || congregationItems[0]?.id || ""
      }));
      await loadPanelData(defaultCongregation);
      lastLoadedCongregationRef.current = defaultCongregation;
      void loadDiscipleshipUsers(defaultCongregation);
      setLoading(false);
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [loadCongregations, loadDiscipleshipUsers, loadPanelData]);

  useEffect(() => {
    if (!hasAccess) return;
    if (loading) return;
    setNewModule((prev) => ({
      ...prev,
      congregation_id: congregationFilter || prev.congregation_id
    }));
    setNewUser((prev) => ({
      ...prev,
      congregation_id: congregationFilter || prev.congregation_id
    }));
    if (lastLoadedCongregationRef.current === congregationFilter) return;
    lastLoadedCongregationRef.current = congregationFilter;
    loadPanelData(congregationFilter);
    loadDiscipleshipUsers(congregationFilter);
  }, [congregationFilter, hasAccess, loading, loadDiscipleshipUsers, loadPanelData]);

  function updateDraft(id: string, patch: Partial<ModuleDraft>) {
    setModuleDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch }
    }));
  }

  async function handleCreateCongregation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isGlobalAdmin) {
      setCongregationStatusMessage("Somente administração da sede pode criar congregações.");
      return;
    }
    setCongregationStatusMessage("");
    setCongregationSuccessMessage("");

    const name = newCongregation.name.trim();
    const slug = newCongregation.slug.trim();
    if (!name) {
      setCongregationStatusMessage("Informe o nome da congregação.");
      return;
    }

    try {
      const data = await apiFetch("/api/admin/congregations", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          isActive: true
        })
      });
      const created = data.congregation as Congregation | undefined;
      const refreshed = await loadCongregations();
      const nextCongregationId = created?.id ?? refreshed[0]?.id ?? "";
      if (nextCongregationId) {
        setCongregationFilter(nextCongregationId);
        setNewModule((prev) => ({ ...prev, congregation_id: nextCongregationId }));
        setNewUser((prev) => ({ ...prev, congregation_id: nextCongregationId }));
      }
      setNewCongregation({ name: "", slug: "" });
      setCongregationSuccessMessage("Congregação criada e pronta para receber usuários.");
    } catch (error) {
      setCongregationStatusMessage((error as Error).message);
    }
  }

  async function handleToggleCongregation(congregationId: string, nextIsActive: boolean) {
    if (!isGlobalAdmin) {
      setCongregationStatusMessage("Somente administração da sede pode editar congregações.");
      return;
    }
    setCongregationStatusMessage("");
    setCongregationSuccessMessage("");
    try {
      await apiFetch(`/api/admin/congregations/${congregationId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextIsActive })
      });
      await loadCongregations();
      setCongregationSuccessMessage(nextIsActive ? "Congregação ativada." : "Congregação desativada.");
    } catch (error) {
      setCongregationStatusMessage((error as Error).message);
    }
  }

  async function handleSaveConfraternizationDate() {
    setCalendarStatusMessage("");
    setCalendarSuccessMessage("");

    const targetCongregation = congregationFilter || managerCongregationId || "";
    if (!targetCongregation) {
      setCalendarStatusMessage("Selecione uma congregação para configurar a data da confraternização.");
      return;
    }
    if (!confraternizationAtDraft) {
      setCalendarStatusMessage("Informe a data e hora da confraternização.");
      return;
    }

    const parsedDate = new Date(confraternizationAtDraft);
    if (Number.isNaN(parsedDate.getTime())) {
      setCalendarStatusMessage("Data da confraternização inválida.");
      return;
    }

    try {
      const response = await apiFetch("/api/admin/discipulado/calendar", {
        method: "POST",
        body: JSON.stringify({
          congregationId: targetCongregation,
          confraternizationAt: parsedDate.toISOString(),
          recalculate: true
        })
      });
      if (response.warning) {
        setCalendarStatusMessage(String(response.warning));
      }
    } catch (error) {
      setCalendarStatusMessage((error as Error).message);
      return;
    }

    setCalendarSuccessMessage("Data da confraternização salva. Criticidade recalculada para a congregação.");
    await loadPanelData(targetCongregation);
  }

  async function handleRecalculateCriticalityNow() {
    setCalendarStatusMessage("");
    setCalendarSuccessMessage("");

    const targetCongregation = congregationFilter || managerCongregationId || "";
    if (!targetCongregation) {
      setCalendarStatusMessage("Selecione uma congregação para recalcular a criticidade.");
      return;
    }

    try {
      const response = await apiFetch("/api/admin/discipulado/calendar", {
        method: "POST",
        body: JSON.stringify({
          congregationId: targetCongregation,
          recalculate: true,
          recalculateOnly: true
        })
      });
      if (response.warning) {
        setCalendarStatusMessage(String(response.warning));
        return;
      }
    } catch (error) {
      setCalendarStatusMessage((error as Error).message);
      return;
    }

    setCalendarSuccessMessage("Criticidade recalculada com sucesso.");
    await loadPanelData(targetCongregation);
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;

    setStatusMessage("");
    setSuccessMessage("");

    const targetCongregation = newModule.congregation_id || congregationFilter || managerCongregationId;
    if (!targetCongregation) {
      setStatusMessage("Selecione uma congregação para criar o módulo.");
      return;
    }

    const parsedOrder = Number(newModule.sort_order);
    const sortOrder = Number.isFinite(parsedOrder) ? Math.max(0, Math.round(parsedOrder)) : 0;

    const { error } = await supabaseClient.from("discipleship_modules").insert({
      congregation_id: targetCongregation,
      title: newModule.title.trim(),
      description: newModule.description.trim() || null,
      sort_order: sortOrder,
      is_active: true
    });

    if (error) {
      if (error.code === "23505") {
        setStatusMessage("Já existe um módulo com este título nessa congregação.");
        return;
      }
      setStatusMessage(error.message);
      return;
    }

    setSuccessMessage("Módulo criado com sucesso.");
    setNewModule((prev) => ({
      ...prev,
      title: "",
      description: "",
      sort_order: String(sortOrder + 1)
    }));
    await loadPanelData(congregationFilter);
  }

  async function handleSaveModule(moduleId: string) {
    if (!supabaseClient) return;
    const draft = moduleDrafts[moduleId];
    if (!draft) return;

    setStatusMessage("");
    setSuccessMessage("");

    const parsedOrder = Number(draft.sort_order);
    const sortOrder = Number.isFinite(parsedOrder) ? Math.max(0, Math.round(parsedOrder)) : 0;

    const { error } = await supabaseClient
      .from("discipleship_modules")
      .update({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        sort_order: sortOrder
      })
      .eq("id", moduleId);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setSuccessMessage("Módulo atualizado.");
    await loadPanelData(congregationFilter);
  }

  async function handleToggleModule(moduleId: string, nextValue: boolean) {
    if (!supabaseClient) return;
    setStatusMessage("");
    setSuccessMessage("");

    const { error } = await supabaseClient
      .from("discipleship_modules")
      .update({ is_active: nextValue })
      .eq("id", moduleId);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setSuccessMessage(nextValue ? "Módulo ativado." : "Módulo desativado.");
    await loadPanelData(congregationFilter);
  }

  async function handleDeleteModule(moduleId: string, moduleTitle: string) {
    if (!supabaseClient) return;
    const confirmDelete = window.confirm(`Excluir o módulo "${moduleTitle}"? Esta ação não pode ser desfeita.`);
    if (!confirmDelete) return;

    setStatusMessage("");
    setSuccessMessage("");

    const { error } = await supabaseClient.from("discipleship_modules").delete().eq("id", moduleId);
    if (error) {
      if (error.code === "23503") {
        setStatusMessage("Não foi possível excluir: existem registros vinculados a este módulo.");
        return;
      }
      setStatusMessage(error.message);
      return;
    }

    setSuccessMessage("Módulo excluído com sucesso.");
    await loadPanelData(congregationFilter);
  }

  async function handleCreateDiscipuladoUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserStatusMessage("");
    setUserSuccessMessage("");

    const role = newUser.role;
    const email = newUser.email.trim();
    const password = newUser.password.trim();
    const whatsapp = newUser.whatsapp.trim();
    const isGlobalDiscipuladoAdmin = isGlobalAdmin && newUserGlobalScope && role === "ADMIN_DISCIPULADO";
    const congregationId = isGlobalDiscipuladoAdmin
      ? null
      : newUser.congregation_id || congregationFilter || managerCongregationId;

    if (!email || !password) {
      setUserStatusMessage("Informe e-mail e senha para criar o usuário.");
      return;
    }
    if (!congregationId && !isGlobalDiscipuladoAdmin) {
      setUserStatusMessage("Selecione a congregação para o usuário de discipulado.");
      return;
    }

    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          congregationId,
          whatsapp: whatsapp || null
        })
      });
      setNewUser((prev) => ({
        ...prev,
        email: "",
        password: "",
        whatsapp: "",
        congregation_id: congregationId ?? prev.congregation_id
      }));
      setNewUserGlobalScope(false);
      setUserSuccessMessage(`${getDiscipuladoRoleLabel(role)} criado com sucesso.`);
      if (isGlobalDiscipuladoAdmin && isGlobalAdmin) {
        setCongregationFilter("");
        await loadDiscipleshipUsers("");
      } else {
        await loadDiscipleshipUsers(congregationFilter || congregationId || "");
      }
    } catch (error) {
      setUserStatusMessage((error as Error).message);
    }
  }

  async function handleToggleDiscipuladoRole(
    userId: string,
    role: DiscipuladoUserRole,
    nextActive: boolean,
    congregationId: string | null
  ) {
    setUserStatusMessage("");
    setUserSuccessMessage("");
    const isGlobalDiscipuladoAdmin = role === "ADMIN_DISCIPULADO" && congregationId === null && isGlobalAdmin;
    const targetCongregation = isGlobalDiscipuladoAdmin
      ? null
      : congregationId ?? congregationFilter ?? managerCongregationId;
    if (!targetCongregation && !isGlobalDiscipuladoAdmin) {
      setUserStatusMessage("Não foi possível identificar a congregação deste usuário.");
      return;
    }
    try {
      await apiFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({
          userId,
          role,
          active: nextActive,
          congregationId: targetCongregation
        })
      });
      setUserSuccessMessage(
        nextActive
          ? `Acesso ${getDiscipuladoRoleLabel(role)} ativado.`
          : `Acesso ${getDiscipuladoRoleLabel(role)} desativado.`
      );
      await loadDiscipleshipUsers(congregationFilter || targetCongregation || "");
    } catch (error) {
      setUserStatusMessage((error as Error).message);
    }
  }

  async function handleDeleteDiscipuladoUser(userId: string, userEmail: string | null) {
    const confirmDelete = window.confirm(
      `Excluir o usuário "${userEmail ?? userId}" do discipulado? Esta ação pode remover a conta de acesso.`
    );
    if (!confirmDelete) return;

    setUserStatusMessage("");
    setUserSuccessMessage("");

    try {
      const response = await apiFetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ userId })
      });

      const mode = String(response.mode ?? "");
      if (mode === "roles_removed") {
        setUserSuccessMessage(
          "Usuário removido do discipulado. A conta foi mantida porque possui outros papéis ativos."
        );
      } else {
        setUserSuccessMessage("Usuário excluído com sucesso.");
      }

      await loadDiscipleshipUsers(congregationFilter || managerCongregationId || "");
    } catch (error) {
      setUserStatusMessage((error as Error).message);
    }
  }

  if (loading) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Carregando painel administrativo...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito ao perfil administrativo do discipulado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-2xl font-semibold text-sky-950">Administração</h2>
          <p className="text-sm text-slate-600">Gestão de módulos e operação por congregação.</p>
        </div>
        <div className="flex items-center gap-2">
          {isGlobalAdmin ? (
            <select
              value={congregationFilter}
              onChange={(event) => setCongregationFilter(event.target.value)}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
            >
              <option value="">Todas as congregações</option>
              {congregations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.is_active ? "" : " (inativa)"}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900">
              {congregationNameById[managerCongregationId ?? ""] ?? "Sua congregação"}
            </div>
          )}
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {isGlobalAdmin ? (
      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Congregações (tenants)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre novas congregações e habilite o ambiente delas para discipulado.
        </p>

        {congregationStatusMessage ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {congregationStatusMessage}
          </p>
        ) : null}
        {congregationSuccessMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {congregationSuccessMessage}
          </p>
        ) : null}

        <form onSubmit={handleCreateCongregation} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome da congregação</span>
            <input
              value={newCongregation.name}
              onChange={(event) =>
                setNewCongregation((prev) => ({
                  ...prev,
                  name: event.target.value
                }))
              }
              placeholder="Ex.: Madureira Campo Grande"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Slug (opcional)</span>
            <input
              value={newCongregation.slug}
              onChange={(event) =>
                setNewCongregation((prev) => ({
                  ...prev,
                  slug: event.target.value
                }))
              }
              placeholder="madureira-campo-grande"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <div className="flex items-end xl:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Criar congregação
            </button>
          </div>
          <div className="flex items-end text-xs text-slate-500">
            Cada congregação criada já pode receber usuários ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO ou
            SECRETARIA_DISCIPULADO vinculados.
          </div>
        </form>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Tenants totais</p>
            <p className="mt-2 text-2xl font-bold text-sky-950">{tenantStats.total}</p>
          </article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tenants ativos</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{tenantStats.active}</p>
          </article>
          <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Tenants inativos</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{tenantStats.inactive}</p>
          </article>
          <article className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Último tenant</p>
            <p className="mt-2 text-sm font-semibold text-indigo-900">{tenantStats.newest?.name ?? "-"}</p>
          </article>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span>Distribuição de tenants</span>
            <span>{tenantStats.activeRatio}% ativos</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${tenantStats.activeRatio}%` }}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {!congregations.length ? <p className="text-sm text-slate-600">Nenhuma congregação cadastrada.</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {congregations.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">slug: {item.slug}</p>
                    <p className="text-xs text-slate-500">criada em {formatDateBR(item.created_at)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.is_active ? "ATIVA" : "INATIVA"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">ID: {item.id.slice(0, 8)}...</p>
                  <button
                    type="button"
                    onClick={() => handleToggleCongregation(item.id, !item.is_active)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                      item.is_active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {item.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Módulos totais</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{modules.length}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Módulos ativos</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{activeModulesCount}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Cases em aberto</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{openCasesCount}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Cases totais</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{totalCasesCount}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">Usuários ativos</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{activeDiscipleshipUsers}</p>
        </article>
      </div>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Confraternização da congregação</h3>
        <p className="mt-1 text-sm text-slate-600">
          A criticidade de contato usa esta data para calcular os dias restantes até a confra.
        </p>
        {calendarStatusMessage ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {calendarStatusMessage}
          </p>
        ) : null}
        {calendarSuccessMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {calendarSuccessMessage}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Data e hora da confra</span>
            <input
              type="datetime-local"
              value={confraternizationAtDraft}
              onChange={(event) => setConfraternizationAtDraft(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSaveConfraternizationDate}
              className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Salvar data da confra
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleRecalculateCriticalityNow}
              className="w-full rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50"
            >
              Recalcular criticidade agora
            </button>
          </div>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Usuários do discipulado</h3>
        <p className="mt-1 text-sm text-slate-600">
          Contas com papéis <strong>ADMIN_DISCIPULADO</strong>, <strong>DISCIPULADOR</strong>,{" "}
          <strong>SM_DISCIPULADO</strong> e <strong>SECRETARIA_DISCIPULADO</strong> acessam apenas o módulo de
          discipulado.
        </p>

        {userStatusMessage ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {userStatusMessage}
          </p>
        ) : null}
        {userSuccessMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {userSuccessMessage}
          </p>
        ) : null}

        <form onSubmit={handleCreateDiscipuladoUser} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Perfil</span>
            <select
              value={newUser.role}
              onChange={(event) =>
                {
                  const nextRole = event.target.value as DiscipuladoUserRole;
                  setNewUser((prev) => ({
                    ...prev,
                    role: nextRole
                  }));
                  if (nextRole !== "ADMIN_DISCIPULADO") {
                    setNewUserGlobalScope(false);
                  }
                }
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            >
              <option value="ADMIN_DISCIPULADO">Admin Discipulado</option>
              <option value="DISCIPULADOR">Discipulador (completo)</option>
              <option value="SM_DISCIPULADO">SM Discipulado (somente cadastro)</option>
              <option value="SECRETARIA_DISCIPULADO">Secretária Discipulado (somente cadastro)</option>
            </select>
          </label>
          {isGlobalAdmin ? (
            <div className="space-y-2 text-sm">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Congregação</span>
                <select
                  value={newUser.congregation_id}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      congregation_id: event.target.value
                    }))
                  }
                  disabled={newUserGlobalScope}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Selecione</option>
                  {selectableCongregations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {newUser.role === "ADMIN_DISCIPULADO" ? (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newUserGlobalScope}
                    onChange={(event) => setNewUserGlobalScope(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                  />
                  Criar como administrador global do discipulado (sem congregação)
                </label>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <span className="text-slate-700">Congregação</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {congregationNameById[managerCongregationId ?? ""] ?? "Sua congregação"}
              </div>
            </div>
          )}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">E-mail</span>
            <input
              type="email"
              value={newUser.email}
              onChange={(event) =>
                setNewUser((prev) => ({
                  ...prev,
                  email: event.target.value
                }))
              }
              placeholder="discipulado@congregacao.org"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Senha inicial</span>
            <input
              type="password"
              value={newUser.password}
              onChange={(event) =>
                setNewUser((prev) => ({
                  ...prev,
                  password: event.target.value
                }))
              }
              placeholder="mínimo 6 caracteres"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">WhatsApp (opcional)</span>
            <input
              value={newUser.whatsapp}
              onChange={(event) =>
                setNewUser((prev) => ({
                  ...prev,
                  whatsapp: event.target.value
                }))
              }
              placeholder="(11) 99999-9999"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Criar usuário
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {usersLoading ? <p className="text-sm text-slate-600">Carregando usuários...</p> : null}
          {!usersLoading && !filteredDiscipleshipUsers.length ? (
            <p className="text-sm text-slate-600">Nenhum usuário de discipulado cadastrado.</p>
          ) : null}
          {filteredDiscipleshipUsers.map((user) => {
            const discipuladoRole = user.roles.find((role) =>
              DISCIPULADO_USER_ROLES.includes(role.role as DiscipuladoUserRole)
            );
            if (!discipuladoRole) return null;
            const isActive = Boolean(discipuladoRole.active);
            const roleCongregationId = discipuladoRole.congregation_id ?? null;
            return (
              <article key={user.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.email ?? "Sem e-mail"}</p>
                    <p className="text-xs text-slate-500">
                      {getDiscipuladoRoleLabel(discipuladoRole.role)}
                      {" • "}
                      Criado em {formatDateBR(user.created_at)}
                      {roleCongregationId
                        ? ` • ${congregationNameById[roleCongregationId] ?? "Congregação"}`
                        : " • Global do discipulado"}
                      {user.whatsapp ? ` • WhatsApp: ${user.whatsapp}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleDiscipuladoRole(
                        user.id,
                        discipuladoRole.role as DiscipuladoUserRole,
                        !isActive,
                        roleCongregationId
                      )
                    }
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                      isActive ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {isActive ? "Desativar acesso" : "Ativar acesso"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDiscipuladoUser(user.id, user.email)}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Excluir usuário
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Criar módulo</h3>
        <form onSubmit={handleCreateModule} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {isGlobalAdmin ? (
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Congregação</span>
              <select
                value={newModule.congregation_id}
                onChange={(event) =>
                  setNewModule((prev) => ({
                    ...prev,
                    congregation_id: event.target.value
                  }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              >
                <option value="">Selecione</option>
                {selectableCongregations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-1 text-sm">
              <span className="text-slate-700">Congregação</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {congregationNameById[managerCongregationId ?? newModule.congregation_id] ?? "Sua congregação"}
              </div>
            </div>
          )}
          <label className="space-y-1 text-sm md:col-span-1 xl:col-span-2">
            <span className="text-slate-700">Título</span>
            <input
              value={newModule.title}
              onChange={(event) =>
                setNewModule((prev) => ({
                  ...prev,
                  title: event.target.value
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              placeholder="Ex.: Fundamentos da fé"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Ordem</span>
            <input
              type="number"
              min={0}
              value={newModule.sort_order}
              onChange={(event) =>
                setNewModule((prev) => ({
                  ...prev,
                  sort_order: event.target.value
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Criar módulo
            </button>
          </div>
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-5">
            <span className="text-slate-700">Descrição</span>
            <textarea
              value={newModule.description}
              onChange={(event) =>
                setNewModule((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              placeholder="Resumo do conteúdo do módulo"
            />
          </label>
        </form>
      </section>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Catálogo de módulos</h3>
        <div className="mt-3 space-y-3">
          {!modules.length ? <p className="text-sm text-slate-600">Nenhum módulo cadastrado.</p> : null}
          {modules.map((module) => (
            <article key={module.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-1 text-sm md:col-span-1 xl:col-span-2">
                  <span className="text-slate-700">Título</span>
                  <input
                    value={moduleDrafts[module.id]?.title ?? ""}
                    onChange={(event) => updateDraft(module.id, { title: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-700">Ordem</span>
                  <input
                    type="number"
                    min={0}
                    value={moduleDrafts[module.id]?.sort_order ?? "0"}
                    onChange={(event) => updateDraft(module.id, { sort_order: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500">Congregação</p>
                  <p className="font-semibold text-slate-900">{congregationNameById[module.congregation_id] ?? "-"}</p>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveModule(module.id)}
                    className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:border-sky-400"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleModule(module.id, !module.is_active)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                      module.is_active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {module.is_active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteModule(module.id, module.title)}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Excluir
                  </button>
                </div>
                <label className="space-y-1 text-sm md:col-span-2 xl:col-span-5">
                  <span className="text-slate-700">Descrição</span>
                  <textarea
                    rows={2}
                    value={moduleDrafts[module.id]?.description ?? ""}
                    onChange={(event) => updateDraft(module.id, { description: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Última atualização: {module.updated_at ? formatDateBR(module.updated_at) : "-"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
