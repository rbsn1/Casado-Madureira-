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

type IntegrationStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONTATO" | "INTEGRADO" | "BATIZADO";

type IntegrationItem = {
  id: string;
  pessoa_id: string;
  status: IntegrationStatus;
  notas: string | null;
  responsavel_id: string | null;
  ultima_interacao: string | null;
  updated_at: string | null;
};

type BaptismItem = {
  id: string;
  data: string;
  local: string | null;
  observacoes: string | null;
  created_at: string;
};

type DepartmentItem = {
  id: string;
  nome: string;
};

type DepartmentLinkItem = {
  id: string;
  departamento_id: string;
  funcao: string | null;
  status: string | null;
  desde: string | null;
};

const INTEGRATION_STATUS_OPTIONS: IntegrationStatus[] = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONTATO",
  "INTEGRADO",
  "BATIZADO"
];

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
  const [integrationData, setIntegrationData] = useState<IntegrationItem | null>(null);
  const [integrationStatusDraft, setIntegrationStatusDraft] = useState<IntegrationStatus>("PENDENTE");
  const [integrationNotesDraft, setIntegrationNotesDraft] = useState("");
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [departmentLinks, setDepartmentLinks] = useState<DepartmentLinkItem[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [departmentRoleDraft, setDepartmentRoleDraft] = useState("");
  const [baptismDate, setBaptismDate] = useState("");
  const [baptismLocation, setBaptismLocation] = useState("");
  const [baptismNotes, setBaptismNotes] = useState("");
  const [baptisms, setBaptisms] = useState<BaptismItem[]>([]);
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
    const [
      { data: moduleResult, error: moduleError },
      { data: integrationResult, error: integrationError },
      { data: departmentsResult, error: departmentsError },
      { data: linksResult, error: linksError },
      { data: baptismResult, error: baptismError }
    ] = await Promise.all([
      moduleIds.length
        ? supabaseClient
            .from("discipleship_modules")
            .select("id, title, description, sort_order")
            .in("id", moduleIds)
        : Promise.resolve({ data: [], error: null as any }),
      supabaseClient
        .from("integracao_novos_convertidos")
        .select("id, pessoa_id, status, notas, responsavel_id, ultima_interacao, updated_at")
        .eq("pessoa_id", currentCase.member_id)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabaseClient.from("departamentos").select("id, nome").eq("ativo", true).order("nome"),
      supabaseClient
        .from("pessoa_departamento")
        .select("id, departamento_id, funcao, status, desde")
        .eq("pessoa_id", currentCase.member_id)
        .neq("status", "INATIVO"),
      supabaseClient
        .from("batismos")
        .select("id, data, local, observacoes, created_at")
        .eq("pessoa_id", currentCase.member_id)
        .order("data", { ascending: false })
        .limit(5)
    ]);

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
    const integrationRows: unknown[] = Array.isArray(integrationResult) ? integrationResult : [];
    const integrationCandidate = integrationRows[0] as Partial<IntegrationItem> | undefined;
    const integrationRow: IntegrationItem | null =
      integrationCandidate?.id && integrationCandidate?.pessoa_id && integrationCandidate?.status
        ? {
            id: String(integrationCandidate.id),
            pessoa_id: String(integrationCandidate.pessoa_id),
            status: integrationCandidate.status as IntegrationStatus,
            notas: integrationCandidate.notas ?? null,
            responsavel_id: integrationCandidate.responsavel_id ?? null,
            ultima_interacao: integrationCandidate.ultima_interacao ?? null,
            updated_at: integrationCandidate.updated_at ?? null
          }
        : null;
    setIntegrationData(integrationRow);
    setIntegrationStatusDraft(integrationRow?.status ?? "PENDENTE");
    setIntegrationNotesDraft(integrationRow?.notas ?? "");

    const departmentRows = (Array.isArray(departmentsResult) ? departmentsResult : [])
      .map((row) => {
        const item = row as Partial<DepartmentItem>;
        if (!item.id || !item.nome) return null;
        return { id: String(item.id), nome: String(item.nome) } as DepartmentItem;
      })
      .filter((item): item is DepartmentItem => item !== null);
    setDepartments(departmentRows);
    setSelectedDepartmentId((prev) =>
      prev && departmentRows.some((item) => item.id === prev) ? prev : (departmentRows[0]?.id ?? "")
    );
    const departmentLinkRows = (Array.isArray(linksResult) ? linksResult : [])
      .map((row) => {
        const item = row as Partial<DepartmentLinkItem>;
        if (!item.id || !item.departamento_id) return null;
        return {
          id: String(item.id),
          departamento_id: String(item.departamento_id),
          funcao: item.funcao ?? null,
          status: item.status ?? null,
          desde: item.desde ?? null
        } as DepartmentLinkItem;
      })
      .filter((item): item is DepartmentLinkItem => item !== null);
    setDepartmentLinks(departmentLinkRows);
    const baptismRows = (Array.isArray(baptismResult) ? baptismResult : [])
      .map((row) => {
        const item = row as Partial<BaptismItem>;
        if (!item.id || !item.data || !item.created_at) return null;
        return {
          id: String(item.id),
          data: String(item.data),
          local: item.local ?? null,
          observacoes: item.observacoes ?? null,
          created_at: String(item.created_at)
        } as BaptismItem;
      })
      .filter((item): item is BaptismItem => item !== null);
    setBaptisms(baptismRows);
    setBaptismDate((prev) => prev || new Date().toISOString().slice(0, 10));

    const secondaryError =
      integrationError?.message ??
      departmentsError?.message ??
      linksError?.message ??
      baptismError?.message ??
      "";
    if (secondaryError) {
      setStatusMessage(secondaryError);
    }
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const scope = await getAuthScope();
      if (!active) return;
      const isGlobalAdmin =
        scope.isAdminMaster || scope.roles.includes("ADMIN_MASTER") || scope.roles.includes("SUPER_ADMIN");
      const allowed = isGlobalAdmin || scope.roles.includes("DISCIPULADOR");
      setHasAccess(allowed);
      setIsAdminMaster(isGlobalAdmin);
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

  const departmentNameById = useMemo(
    () =>
      departments.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.nome;
        return acc;
      }, {}),
    [departments]
  );

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
    if (totalModules === 0) {
      setStatusMessage("Não é possível concluir: nenhum módulo foi gerado para este discipulado.");
      return;
    }
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

  async function handleSaveIntegration() {
    if (!supabaseClient || !member) return;
    setStatusMessage("");

    if (integrationData) {
      const { error } = await supabaseClient
        .from("integracao_novos_convertidos")
        .update({
          status: integrationStatusDraft,
          notas: integrationNotesDraft.trim() || null,
          ultima_interacao: new Date().toISOString(),
          responsavel_id: currentUserId
        })
        .eq("id", integrationData.id);
      if (error) {
        setStatusMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabaseClient.from("integracao_novos_convertidos").insert({
        pessoa_id: member.id,
        status: integrationStatusDraft,
        notas: integrationNotesDraft.trim() || null,
        ultima_interacao: new Date().toISOString(),
        responsavel_id: currentUserId
      });
      if (error) {
        setStatusMessage(error.message);
        return;
      }
    }

    await loadCase();
  }

  async function handleRegisterBaptism() {
    if (!supabaseClient || !member) return;
    if (!baptismDate) {
      setStatusMessage("Informe a data do batismo.");
      return;
    }

    setStatusMessage("");
    const { error: baptismError } = await supabaseClient.from("batismos").insert({
      pessoa_id: member.id,
      data: baptismDate,
      local: baptismLocation.trim() || null,
      observacoes: baptismNotes.trim() || null,
      responsavel_id: currentUserId
    });

    if (baptismError) {
      setStatusMessage(baptismError.message);
      return;
    }

    const nowIso = new Date().toISOString();
    if (integrationData) {
      await supabaseClient
        .from("integracao_novos_convertidos")
        .update({
          status: "BATIZADO",
          ultima_interacao: nowIso,
          responsavel_id: currentUserId
        })
        .eq("id", integrationData.id);
    } else {
      await supabaseClient.from("integracao_novos_convertidos").insert({
        pessoa_id: member.id,
        status: "BATIZADO",
        ultima_interacao: nowIso,
        responsavel_id: currentUserId
      });
    }

    setIntegrationStatusDraft("BATIZADO");
    setBaptismLocation("");
    setBaptismNotes("");
    await loadCase();
  }

  async function handleLinkDepartment() {
    if (!supabaseClient || !member) return;
    if (!selectedDepartmentId) {
      setStatusMessage("Selecione um departamento.");
      return;
    }

    const alreadyLinked = departmentLinks.some(
      (item) => item.departamento_id === selectedDepartmentId && item.status !== "INATIVO"
    );
    if (alreadyLinked) {
      setStatusMessage("Este membro já está vinculado a este departamento.");
      return;
    }

    setStatusMessage("");
    const { error } = await supabaseClient.from("pessoa_departamento").insert({
      pessoa_id: member.id,
      departamento_id: selectedDepartmentId,
      funcao: departmentRoleDraft.trim() || null,
      status: "ATIVO"
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setDepartmentRoleDraft("");
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

      <section className="discipulado-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-sky-900">Integração e pós-discipulado</h3>
            <p className="text-xs text-slate-600">
              Fluxo operacional do discipulado: integração, batismo e vínculo em departamento.
            </p>
          </div>
          <StatusBadge value={integrationStatusDraft} />
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-100 bg-white p-4 lg:col-span-1">
            <h4 className="text-sm font-semibold text-slate-900">Status de integração</h4>
            <p className="mt-1 text-xs text-slate-600">
              Última atualização: {integrationData?.updated_at ? formatDateBR(integrationData.updated_at) : "-"}
            </p>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Status</span>
              <select
                value={integrationStatusDraft}
                onChange={(event) => setIntegrationStatusDraft(event.target.value as IntegrationStatus)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              >
                {INTEGRATION_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Notas de integração</span>
              <textarea
                rows={3}
                value={integrationNotesDraft}
                onChange={(event) => setIntegrationNotesDraft(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveIntegration}
              className="mt-3 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800"
            >
              Salvar integração
            </button>
          </article>

          <article className="rounded-xl border border-slate-100 bg-white p-4 lg:col-span-1">
            <h4 className="text-sm font-semibold text-slate-900">Registrar batismo</h4>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Data</span>
              <input
                type="date"
                value={baptismDate}
                onChange={(event) => setBaptismDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              />
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Local</span>
              <input
                value={baptismLocation}
                onChange={(event) => setBaptismLocation(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              />
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Observações</span>
              <textarea
                rows={2}
                value={baptismNotes}
                onChange={(event) => setBaptismNotes(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleRegisterBaptism}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Registrar batismo
            </button>
            {baptisms.length ? (
              <p className="mt-3 text-xs text-slate-600">
                Último batismo: {formatDateBR(baptisms[0].data)} {baptisms[0].local ? `• ${baptisms[0].local}` : ""}
              </p>
            ) : null}
          </article>

          <article className="rounded-xl border border-slate-100 bg-white p-4 lg:col-span-1">
            <h4 className="text-sm font-semibold text-slate-900">Vincular ao departamento</h4>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Departamento</span>
              <select
                value={selectedDepartmentId}
                onChange={(event) => setSelectedDepartmentId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              >
                <option value="">Selecione</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-700">Função (opcional)</span>
              <input
                value={departmentRoleDraft}
                onChange={(event) => setDepartmentRoleDraft(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleLinkDepartment}
              className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800"
            >
              Vincular departamento
            </button>
            {departmentLinks.length ? (
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {departmentLinks.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {departmentNameById[item.departamento_id] ?? "Departamento"} • {item.funcao ?? "Sem função"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Sem vínculo em departamento.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
