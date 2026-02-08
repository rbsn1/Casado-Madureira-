"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { formatDateBR } from "@/lib/date";

type CaseItem = {
  id: string;
  member_id: string;
  status: "em_discipulado" | "concluido" | "pausado";
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type MemberItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  igreja_origem: string | null;
  bairro: string | null;
};

type ProgressItem = {
  id: string;
  case_id: string;
  module_id: string;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  completed_at: string | null;
  notes: string | null;
};

type ModuleItem = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

function caseBadgeValue(status: CaseItem["status"]) {
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

function progressBadgeValue(status: ProgressItem["status"]) {
  if (status === "nao_iniciado") return "NAO_INICIADO";
  if (status === "em_andamento") return "EM_ANDAMENTO";
  return "CONCLUIDO";
}

export default function DiscipulandoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const caseId = String(params?.id ?? "");
  const [caseData, setCaseData] = useState<CaseItem | null>(null);
  const [member, setMember] = useState<MemberItem | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [modules, setModules] = useState<Record<string, ModuleItem>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCase = useCallback(async () => {
    if (!supabaseClient || !caseId) return;

    setLoading(true);
    setStatusMessage("");

    const [{ data: caseResult, error: caseError }, { data: userData }] = await Promise.all([
      supabaseClient
        .from("discipleship_cases")
        .select("id, member_id, status, notes, assigned_to, created_at, updated_at")
        .eq("id", caseId)
        .single(),
      supabaseClient.auth.getUser()
    ]);

    if (caseError) {
      setStatusMessage(caseError.message);
      setLoading(false);
      return;
    }

    const currentCase = caseResult as CaseItem;
    setCaseData(currentCase);
    setCurrentUserId(userData.user?.id ?? null);

    const [{ data: memberResult, error: memberError }, { data: progressResult, error: progressError }] =
      await Promise.all([
        supabaseClient
          .from("pessoas")
          .select("id, nome_completo, telefone_whatsapp, origem, igreja_origem, bairro")
          .eq("id", currentCase.member_id)
          .single(),
        supabaseClient
          .from("discipleship_progress")
          .select("id, case_id, module_id, status, completed_at, notes")
          .eq("case_id", currentCase.id)
      ]);

    if (memberError || progressError) {
      setStatusMessage(memberError?.message ?? progressError?.message ?? "Falha ao carregar progresso.");
      setLoading(false);
      return;
    }

    const progressRows = (progressResult ?? []) as ProgressItem[];
    const moduleIds = [...new Set(progressRows.map((item) => item.module_id))];
    const { data: moduleResult, error: moduleError } = moduleIds.length
      ? await supabaseClient
          .from("discipleship_modules")
          .select("id, title, description, sort_order")
          .in("id", moduleIds)
      : { data: [], error: null as any };

    if (moduleError) {
      setStatusMessage(moduleError.message);
      setLoading(false);
      return;
    }

    const moduleMap = ((moduleResult ?? []) as ModuleItem[]).reduce<Record<string, ModuleItem>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    const drafts = progressRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.notes ?? "";
      return acc;
    }, {});

    setMember(memberResult as MemberItem);
    setProgress(progressRows);
    setModules(moduleMap);
    setNoteDrafts(drafts);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const scope = await getAuthScope();
      if (!active) return;
      const allowed = scope.roles.includes("ADMIN_MASTER") || scope.roles.includes("DISCIPULADOR");
      setHasAccess(allowed);
      setIsAdminMaster(scope.isAdminMaster);
      if (!allowed) {
        setLoading(false);
        return;
      }
      await loadCase();
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [loadCase]);

  const sortedProgress = useMemo(() => {
    return [...progress].sort((a, b) => {
      const moduleA = modules[a.module_id];
      const moduleB = modules[b.module_id];
      const orderA = moduleA?.sort_order ?? 9999;
      const orderB = moduleB?.sort_order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (moduleA?.title ?? "").localeCompare(moduleB?.title ?? "");
    });
  }, [modules, progress]);

  const doneModules = useMemo(
    () => sortedProgress.filter((item) => item.status === "concluido").length,
    [sortedProgress]
  );
  const totalModules = sortedProgress.length;
  const progressPercent = totalModules ? Math.round((doneModules / totalModules) * 100) : 0;

  async function handleCaseStatus(nextStatus: CaseItem["status"]) {
    if (!supabaseClient || !caseData) return;
    setStatusMessage("");
    const { error } = await supabaseClient.from("discipleship_cases").update({ status: nextStatus }).eq("id", caseData.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadCase();
  }

  async function handleConcludeCase() {
    if (doneModules !== totalModules) {
      setStatusMessage("Para concluir o discipulado, finalize todos os módulos.");
      return;
    }
    await handleCaseStatus("concluido");
  }

  async function handleModuleComplete(item: ProgressItem) {
    if (!supabaseClient) return;
    setStatusMessage("");
    const { error } = await supabaseClient
      .from("discipleship_progress")
      .update({
        status: "concluido",
        completed_at: new Date().toISOString(),
        completed_by: currentUserId,
        notes: noteDrafts[item.id] || null
      })
      .eq("id", item.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadCase();
  }

  async function handleModuleReopen(item: ProgressItem) {
    if (!supabaseClient || !caseData || !isAdminMaster) return;
    setStatusMessage("");
    const { error } = await supabaseClient
      .from("discipleship_progress")
      .update({
        status: "em_andamento",
        completed_at: null,
        completed_by: null
      })
      .eq("id", item.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    if (caseData.status === "concluido") {
      const { error: caseError } = await supabaseClient
        .from("discipleship_cases")
        .update({ status: "em_discipulado" })
        .eq("id", caseData.id);
      if (caseError) {
        setStatusMessage(caseError.message);
        return;
      }
    }

    await loadCase();
  }

  async function handleSaveNotes(item: ProgressItem) {
    if (!supabaseClient) return;
    setStatusMessage("");
    const { error } = await supabaseClient
      .from("discipleship_progress")
      .update({ notes: noteDrafts[item.id] || null })
      .eq("id", item.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadCase();
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito ao perfil de discipulador e administradores.
      </div>
    );
  }

  if (loading) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Carregando discipulando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-2xl font-semibold text-sky-950">{member?.nome_completo ?? "Discipulando"}</h2>
          <p className="text-sm text-slate-600">Atualizado em {caseData?.updated_at ? formatDateBR(caseData.updated_at) : "-"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={caseBadgeValue(caseData?.status ?? "em_discipulado")} />
          <button
            type="button"
            onClick={() => router.push("/discipulado/convertidos")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900"
          >
            Voltar
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      <section className="discipulado-panel p-5">
        <h3 className="text-sm font-semibold text-sky-900">Dados do membro (CCM)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Telefone</p>
            <p className="text-sm font-semibold text-slate-900">{member?.telefone_whatsapp ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Origem</p>
            <p className="text-sm font-semibold text-slate-900">{member?.origem ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Igreja de origem</p>
            <p className="text-sm font-semibold text-slate-900">{member?.igreja_origem ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Bairro</p>
            <p className="text-sm font-semibold text-slate-900">{member?.bairro ?? "-"}</p>
          </div>
        </div>
      </section>

      <section className="discipulado-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-sky-900">Progresso por módulos</h3>
            <p className="text-xs text-slate-600">
              {doneModules}/{totalModules} concluídos ({progressPercent}%)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {caseData?.status === "em_discipulado" ? (
              <button
                onClick={() => handleCaseStatus("pausado")}
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
              >
                Pausar
              </button>
            ) : null}
            {caseData?.status === "pausado" ? (
              <button
                onClick={() => handleCaseStatus("em_discipulado")}
                className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
              >
                Reativar
              </button>
            ) : null}
            <button
              onClick={handleConcludeCase}
              disabled={doneModules !== totalModules}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Concluir discipulado
            </button>
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-sky-600" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="mt-4 space-y-3">
          {sortedProgress.map((item) => {
            const moduleItem = modules[item.module_id];
            return (
              <article key={item.id} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{moduleItem?.title ?? "Módulo"}</h4>
                    <p className="text-xs text-slate-600">{moduleItem?.description ?? "Sem descrição."}</p>
                  </div>
                  <StatusBadge value={progressBadgeValue(item.status)} />
                </div>

                <label className="mt-3 block space-y-1 text-sm">
                  <span className="text-slate-700">Observações do módulo</span>
                  <textarea
                    value={noteDrafts[item.id] ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [item.id]: event.target.value
                      }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.status !== "concluido" ? (
                    <button
                      onClick={() => handleModuleComplete(item)}
                      className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                    >
                      Marcar como concluído
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700">
                      Concluído em {item.completed_at ? formatDateBR(item.completed_at) : "-"}
                    </span>
                  )}
                  <button
                    onClick={() => handleSaveNotes(item)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900"
                  >
                    Salvar observações
                  </button>
                  {isAdminMaster && item.status === "concluido" ? (
                    <button
                      onClick={() => handleModuleReopen(item)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Reabrir módulo
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
