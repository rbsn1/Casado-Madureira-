"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { formatDateBR } from "@/lib/date";

type Congregation = {
  id: string;
  name: string;
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

export default function DiscipuladoAdminPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [congregationFilter, setCongregationFilter] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, ModuleDraft>>({});
  const [openCasesCount, setOpenCasesCount] = useState(0);
  const [totalCasesCount, setTotalCasesCount] = useState(0);
  const [newModule, setNewModule] = useState({
    congregation_id: "",
    title: "",
    description: "",
    sort_order: "1"
  });

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

  const loadPanelData = useCallback(async (targetCongregation: string) => {
    if (!supabaseClient) return;
    setStatusMessage("");
    setSuccessMessage("");

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

    if (targetCongregation) {
      modulesQuery = modulesQuery.eq("congregation_id", targetCongregation);
      openCasesQuery = openCasesQuery.eq("congregation_id", targetCongregation);
      totalCasesQuery = totalCasesQuery.eq("congregation_id", targetCongregation);
    }

    const [
      { data: modulesData, error: modulesError },
      { count: openCases, error: openCasesError },
      { count: totalCases, error: totalCasesError }
    ] = await Promise.all([modulesQuery, openCasesQuery, totalCasesQuery]);

    if (modulesError || openCasesError || totalCasesError) {
      setStatusMessage(
        modulesError?.message ??
          openCasesError?.message ??
          totalCasesError?.message ??
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

      const isGlobalAdmin =
        scope.isAdminMaster || scope.roles.includes("ADMIN_MASTER") || scope.roles.includes("SUPER_ADMIN");
      setHasAccess(isGlobalAdmin);

      if (!isGlobalAdmin) {
        setLoading(false);
        return;
      }

      const { data: congregationsData, error: congregationsError } = await supabaseClient
        .from("congregations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (!active) return;
      if (congregationsError) {
        setStatusMessage(congregationsError.message);
        setLoading(false);
        return;
      }

      const congregationItems = (congregationsData ?? []) as Congregation[];
      setCongregations(congregationItems);

      const defaultCongregation = scope.congregationId ?? "";
      setCongregationFilter(defaultCongregation);
      setNewModule((prev) => ({
        ...prev,
        congregation_id: defaultCongregation || congregationItems[0]?.id || ""
      }));
      await loadPanelData(defaultCongregation);
      setLoading(false);
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [loadPanelData]);

  useEffect(() => {
    if (!hasAccess) return;
    setNewModule((prev) => ({
      ...prev,
      congregation_id: congregationFilter || prev.congregation_id
    }));
    loadPanelData(congregationFilter);
  }, [congregationFilter, hasAccess, loadPanelData]);

  function updateDraft(id: string, patch: Partial<ModuleDraft>) {
    setModuleDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch }
    }));
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;

    setStatusMessage("");
    setSuccessMessage("");

    const targetCongregation = newModule.congregation_id || congregationFilter;
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

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito ao perfil administrativo do discipulado.
      </div>
    );
  }

  if (loading) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Carregando painel administrativo...</div>;
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Criar módulo</h3>
        <form onSubmit={handleCreateModule} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              {congregations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
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
