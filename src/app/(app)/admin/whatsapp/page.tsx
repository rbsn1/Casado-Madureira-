"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatDateBR } from "@/lib/date";

type Congregation = {
  id: string;
  name: string;
};

type UserContext = {
  roles?: string[];
  congregation_id?: string | null;
  is_admin_master?: boolean;
};

type ChurchSettings = {
  whatsapp_group_link: string;
  welcome_template_name: string;
  welcome_enabled: boolean;
};

type MessageJob = {
  id: string;
  contact_id: string;
  status: "PENDENTE" | "ENVIADO" | "ERRO";
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type ContactSummary = {
  id: string;
  name: string;
  phone_e164: string;
};

const allowedRoles = ["ADMIN_MASTER", "SUPER_ADMIN", "SECRETARIA"];

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return toIsoDate(date);
}

function normalizeDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function statusClass(status: MessageJob["status"]) {
  if (status === "ENVIADO") return "border-brand-200 bg-brand-50 text-brand-700";
  if (status === "ERRO") return "border-danger-100 bg-danger-100 text-danger-600";
  return "border-warning-100 bg-warning-100 text-warning-600";
}

function isInvalidJwtErrorMessage(message: string) {
  return message.trim().toLowerCase().includes("invalid jwt");
}

export default function AdminWhatsAppPage() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [congregations, setCongregations] = useState<Congregation[]>([]);

  const [settings, setSettings] = useState<ChurchSettings>({
    whatsapp_group_link: "",
    welcome_template_name: "welcome_ccm",
    welcome_enabled: true
  });

  const [dateFrom, setDateFrom] = useState(getDefaultFromDate);
  const [dateTo, setDateTo] = useState(toIsoDate(new Date()));
  const [messageMode, setMessageMode] = useState<"template" | "text">("template");
  const [dispatchMode, setDispatchMode] = useState<"TESTE" | "PRODUCAO">("TESTE");
  const [testPhoneE164, setTestPhoneE164] = useState("");

  const [jobStatusFilter, setJobStatusFilter] = useState<"TODOS" | "PENDENTE" | "ENVIADO" | "ERRO">("TODOS");
  const [jobs, setJobs] = useState<MessageJob[]>([]);
  const [contactsById, setContactsById] = useState<Record<string, ContactSummary>>({});

  const [pageMessage, setPageMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [enqueueStatus, setEnqueueStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!supabaseClient) {
        if (active) {
          setHasAccess(false);
          setPageMessage("Supabase não configurado.");
        }
        return;
      }

      const { data: contextData, error: contextError } = await supabaseClient.rpc("get_my_context");
      if (!active) return;

      if (contextError) {
        setHasAccess(false);
        setPageMessage(contextError.message);
        return;
      }

      const context = (contextData ?? {}) as UserContext;
      const roles = Array.isArray(context.roles) ? context.roles : [];
      const canAccess = roles.some((role) => allowedRoles.includes(role));
      if (!canAccess) {
        setHasAccess(false);
        setPageMessage("Acesso restrito a ADMIN_MASTER, SUPER_ADMIN e SECRETARIA.");
        return;
      }

      const globalAdmin = Boolean(context.is_admin_master) || roles.includes("SUPER_ADMIN");
      setHasAccess(true);
      setIsGlobalAdmin(globalAdmin);

      if (globalAdmin) {
        const { data: congregationRows, error: congregationError } = await supabaseClient
          .from("congregations")
          .select("id, name")
          .order("name", { ascending: true });

        if (!active) return;

        if (congregationError) {
          setPageMessage(congregationError.message);
        } else {
          const rows = (congregationRows ?? []) as Congregation[];
          setCongregations(rows);
          setTenantId(context.congregation_id ?? rows[0]?.id ?? "");
        }
      } else {
        setTenantId(context.congregation_id ?? "");
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const loadSettings = useCallback(async (targetTenantId: string) => {
    if (!supabaseClient || !targetTenantId) return;

    const { data, error } = await supabaseClient
      .from("church_settings")
      .select("whatsapp_group_link, welcome_template_name, welcome_enabled")
      .eq("tenant_id", targetTenantId)
      .maybeSingle();

    if (error) {
      setPageMessage(error.message);
      return;
    }

    if (!data) {
      setSettings({
        whatsapp_group_link: "",
        welcome_template_name: "welcome_ccm",
        welcome_enabled: true
      });
      return;
    }

    setSettings({
      whatsapp_group_link: data.whatsapp_group_link ?? "",
      welcome_template_name: data.welcome_template_name ?? "welcome_ccm",
      welcome_enabled: Boolean(data.welcome_enabled)
    });
  }, []);

  const loadJobs = useCallback(async (targetTenantId: string, nextStatus = jobStatusFilter) => {
    if (!supabaseClient || !targetTenantId) return;

    setJobsLoading(true);
    setPageMessage("");

    let query = supabaseClient
      .from("message_jobs")
      .select("id, contact_id, status, attempts, last_error, provider_message_id, scheduled_at, sent_at, created_at, payload")
      .eq("tenant_id", targetTenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (nextStatus !== "TODOS") {
      query = query.eq("status", nextStatus);
    }

    const { data, error } = await query;
    if (error) {
      setPageMessage(error.message);
      setJobsLoading(false);
      return;
    }

    const rows = (data ?? []) as MessageJob[];
    setJobs(rows);

    const contactIds = [...new Set(rows.map((job) => job.contact_id))];
    if (!contactIds.length) {
      setContactsById({});
      setJobsLoading(false);
      return;
    }

    const { data: contactsData, error: contactsError } = await supabaseClient
      .from("contacts")
      .select("id, name, phone_e164")
      .in("id", contactIds);

    if (contactsError) {
      setPageMessage(contactsError.message);
      setJobsLoading(false);
      return;
    }

    const byId = ((contactsData ?? []) as ContactSummary[]).reduce<Record<string, ContactSummary>>(
      (acc, item) => {
        acc[item.id] = item;
        return acc;
      },
      {}
    );

    setContactsById(byId);
    setJobsLoading(false);
  }, [jobStatusFilter]);

  useEffect(() => {
    if (!tenantId) return;
    loadSettings(tenantId);
    loadJobs(tenantId);
  }, [tenantId, loadJobs, loadSettings]);

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !tenantId) return;

    setSaveStatus("loading");
    setPageMessage("");

    const payload = {
      tenant_id: tenantId,
      whatsapp_group_link: settings.whatsapp_group_link.trim() || null,
      welcome_template_name: settings.welcome_template_name.trim() || "welcome_ccm",
      welcome_enabled: settings.welcome_enabled
    };

    const { error } = await supabaseClient
      .from("church_settings")
      .upsert(payload, { onConflict: "tenant_id" });

    if (error) {
      setSaveStatus("error");
      setPageMessage(error.message);
      return;
    }

    setSaveStatus("success");
    setPageMessage("Configurações de WhatsApp salvas.");
  }

  async function handleEnqueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !tenantId) return;
    const client = supabaseClient;

    setEnqueueStatus("loading");
    setPageMessage("");

    const payload = {
      tenant_id: tenantId,
      date_from: dateFrom,
      date_to: dateTo,
      mode: messageMode,
      dispatch_mode: dispatchMode,
      test_phone_e164: dispatchMode === "TESTE" ? normalizeDigits(testPhoneE164) : undefined
    };

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      setEnqueueStatus("error");
      setPageMessage(sessionError.message);
      return;
    }

    const accessToken = sessionData.session?.access_token ?? "";
    if (!accessToken) {
      setEnqueueStatus("error");
      setPageMessage("Sessão expirada. Faça login novamente.");
      return;
    }

    const enqueueWithToken = async (token: string) => {
      try {
        const response = await fetch("/api/admin/whatsapp/enqueue", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const body = (await response.json().catch(() => null)) as { error?: unknown; queued?: unknown } | null;
        if (!response.ok) {
          const message =
            typeof body?.error === "string" && body.error.trim()
              ? body.error
              : `Falha ao enfileirar (HTTP ${response.status}).`;
          return { data: null as { queued?: unknown } | null, error: message };
        }

        return { data: body, error: "" };
      } catch (error) {
        return {
          data: null as { queued?: unknown } | null,
          error: error instanceof Error ? error.message : "Falha ao enfileirar boas-vindas."
        };
      }
    };

    let result = await enqueueWithToken(accessToken);

    if (result.error && isInvalidJwtErrorMessage(result.error)) {
      const { data: refreshedData, error: refreshError } = await client.auth.refreshSession();
      const refreshedToken = refreshedData.session?.access_token ?? "";

      if (!refreshError && refreshedToken) {
        result = await enqueueWithToken(refreshedToken);
      }
    }

    if (result.error) {
      setEnqueueStatus("error");
      setPageMessage(result.error);
      return;
    }

    setEnqueueStatus("success");
    const queued = Number(result.data?.queued ?? 0);
    setPageMessage(`${queued} mensagem(ns) enfileirada(s).`);
    await loadJobs(tenantId);
  }

  const canSubmitTest = useMemo(() => {
    if (dispatchMode !== "TESTE") return true;
    return normalizeDigits(testPhoneE164).length >= 10;
  }, [dispatchMode, testPhoneE164]);

  if (hasAccess === null) {
    return <p className="text-sm text-text-muted">Carregando configuração de WhatsApp...</p>;
  }

  if (!hasAccess) {
    return (
      <div className="card p-4">
        <p className="text-sm text-danger-600">{pageMessage || "Acesso não autorizado."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted">Administração</p>
        <h2 className="text-xl font-semibold text-brand-900">WhatsApp</h2>
      </div>

      <form className="card space-y-4 p-4" onSubmit={handleSaveSettings}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-900">Configurações por tenant</p>
            <p className="text-xs text-text-muted">Link do grupo e template padrão de boas-vindas.</p>
          </div>
        </div>

        {isGlobalAdmin ? (
          <label className="space-y-1 text-sm">
            <span className="text-text">Congregação</span>
            <select
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {congregations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-text">Link do grupo WhatsApp</span>
            <input
              value={settings.whatsapp_group_link}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, whatsapp_group_link: event.target.value }))
              }
              placeholder="https://chat.whatsapp.com/..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Template de boas-vindas</span>
            <input
              value={settings.welcome_template_name}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, welcome_template_name: event.target.value }))
              }
              placeholder="welcome_ccm"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={settings.welcome_enabled}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, welcome_enabled: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Boas-vindas habilitadas
          </label>
        </div>

        <button
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          disabled={saveStatus === "loading"}
        >
          {saveStatus === "loading" ? "Salvando..." : "Salvar configurações"}
        </button>
      </form>

      <form className="card space-y-4 p-4" onSubmit={handleEnqueue}>
        <div>
          <p className="text-sm font-semibold text-brand-900">Enfileirar boas-vindas</p>
          <p className="text-xs text-text-muted">Cria jobs para contatos com opt-in no período selecionado.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-text">Data inicial</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Data final</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Formato</span>
            <select
              value={messageMode}
              onChange={(event) => setMessageMode(event.target.value as "template" | "text")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="template">Template</option>
              <option value="text">Texto simples</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Modo de envio</span>
            <select
              value={dispatchMode}
              onChange={(event) => setDispatchMode(event.target.value as "TESTE" | "PRODUCAO")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="TESTE">TESTE (sandbox)</option>
              <option value="PRODUCAO">PRODUÇÃO</option>
            </select>
          </label>
          {dispatchMode === "TESTE" ? (
            <label className="space-y-1 text-sm md:col-span-2 lg:col-span-2">
              <span className="text-text">Telefone de teste (E.164 com DDI)</span>
              <input
                value={testPhoneE164}
                onChange={(event) => setTestPhoneE164(event.target.value)}
                placeholder="5592992270057"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
          ) : null}
        </div>

        <button
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={enqueueStatus === "loading" || !canSubmitTest}
        >
          {enqueueStatus === "loading" ? "Enfileirando..." : "Enfileirar boas-vindas"}
        </button>
      </form>

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-900">Jobs recentes</p>
            <p className="text-xs text-text-muted">Acompanhe status de entrega (PENDENTE/ENVIADO/ERRO).</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={jobStatusFilter}
              onChange={async (event) => {
                const next = event.target.value as "TODOS" | "PENDENTE" | "ENVIADO" | "ERRO";
                setJobStatusFilter(next);
                if (tenantId) await loadJobs(tenantId, next);
              }}
              className="rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ENVIADO">Enviado</option>
              <option value="ERRO">Erro</option>
            </select>
            <button
              type="button"
              onClick={() => tenantId && loadJobs(tenantId)}
              className="rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-50"
            >
              Atualizar
            </button>
          </div>
        </div>

        {jobsLoading ? (
          <p className="text-sm text-text-muted">Carregando jobs...</p>
        ) : !jobs.length ? (
          <p className="text-sm text-text-muted">Nenhum job encontrado para o filtro atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface">
                <tr>
                  {[
                    "Contato",
                    "Criado em",
                    "Modo",
                    "Status",
                    "Tentativas",
                    "Erro"
                  ].map((label) => (
                    <th key={label} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface">
                {jobs.map((job) => {
                  const contact = contactsById[job.contact_id];
                  const mode = String((job.payload?.mode as string | undefined) ?? "text");
                  const dispatch = String((job.payload?.dispatchMode as string | undefined) ?? "PRODUCAO");
                  return (
                    <tr key={job.id}>
                      <td className="px-3 py-2 text-text">
                        <p className="font-medium">{contact?.name ?? "Contato"}</p>
                        <p className="text-xs text-text-muted">{contact?.phone_e164 ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-text">{formatDateBR(job.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">{mode} / {dispatch}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text">{job.attempts}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">{job.last_error ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pageMessage ? (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text">
          {pageMessage}
        </p>
      ) : null}
    </div>
  );
}
