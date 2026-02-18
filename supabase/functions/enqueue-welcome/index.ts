import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type UserContext = {
  roles?: string[];
  congregation_id?: string | null;
  is_admin_master?: boolean;
};

type ContactRow = {
  id: string;
  name: string;
  phone_e164: string;
  opt_in_whatsapp: boolean;
  created_at: string;
};

type ChurchSettingsRow = {
  whatsapp_group_link: string | null;
  welcome_template_name: string;
  welcome_enabled: boolean;
};

type EnqueueBody = {
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
  mode?: "template" | "text";
  dispatch_mode?: "TESTE" | "PRODUCAO";
  test_phone_e164?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {})
    }
  });
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\D+/g, "");
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, { status: 401 });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      },
      auth: { persistSession: false }
    });

    const body = (await req.json().catch(() => ({}))) as EnqueueBody;
    const tenantId = body.tenant_id?.trim() ?? "";
    const dateFrom = body.date_from?.trim() ?? "";
    const dateTo = body.date_to?.trim() ?? "";

    if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
      return json({ error: "date_from/date_to devem estar no formato YYYY-MM-DD" }, { status: 400 });
    }

    if (new Date(`${dateFrom}T00:00:00Z`) > new Date(`${dateTo}T23:59:59Z`)) {
      return json({ error: "date_from não pode ser maior que date_to" }, { status: 400 });
    }

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Sessão inválida" }, { status: 401 });
    }

    const { data: contextData, error: contextError } = await userClient.rpc("get_my_context");
    if (contextError) {
      return json({ error: contextError.message }, { status: 403 });
    }

    const context = (contextData ?? {}) as UserContext;
    const roles = Array.isArray(context.roles) ? context.roles : [];
    const isGlobalAdmin = Boolean(context.is_admin_master) || roles.includes("SUPER_ADMIN");
    const canEnqueue = roles.some((role) => ["ADMIN_MASTER", "SUPER_ADMIN", "SECRETARIA"].includes(role));

    if (!canEnqueue) {
      return json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const scopedTenantId = tenantId || context.congregation_id || "";
    if (!scopedTenantId) {
      return json({ error: "Não foi possível resolver tenant_id" }, { status: 400 });
    }

    if (!isGlobalAdmin && scopedTenantId !== context.congregation_id) {
      return json({ error: "tenant_id fora do escopo do usuário" }, { status: 403 });
    }

    const dispatchMode = body.dispatch_mode === "TESTE" ? "TESTE" : "PRODUCAO";
    const testPhone = normalizePhone(body.test_phone_e164 ?? "");
    if (dispatchMode === "TESTE" && !testPhone) {
      return json({ error: "No modo TESTE, informe test_phone_e164" }, { status: 400 });
    }

    const requestedMode = body.mode === "text" ? "text" : body.mode === "template" ? "template" : null;

    const { data: settingsData, error: settingsError } = await userClient
      .from("church_settings")
      .select("whatsapp_group_link, welcome_template_name, welcome_enabled")
      .eq("tenant_id", scopedTenantId)
      .maybeSingle();

    if (settingsError) {
      return json({ error: settingsError.message }, { status: 400 });
    }

    const settings = settingsData as ChurchSettingsRow | null;
    if (settings && !settings.welcome_enabled) {
      return json({ error: "Boas-vindas desativadas para este tenant" }, { status: 400 });
    }

    const groupLink = settings?.whatsapp_group_link?.trim() || "";
    const templateName = settings?.welcome_template_name?.trim() || "welcome_ccm";
    const defaultMode: "template" | "text" = templateName ? "template" : "text";
    const mode = requestedMode ?? defaultMode;

    const startIso = `${dateFrom}T00:00:00.000Z`;
    const endIso = `${dateTo}T23:59:59.999Z`;

    const { data: contactsData, error: contactsError } = await userClient
      .from("contacts")
      .select("id, name, phone_e164, opt_in_whatsapp, created_at")
      .eq("tenant_id", scopedTenantId)
      .eq("opt_in_whatsapp", true)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true });

    if (contactsError) {
      return json({ error: contactsError.message }, { status: 400 });
    }

    const contacts = (contactsData ?? []) as ContactRow[];
    if (!contacts.length) {
      return json({ queued: 0, skipped_invalid_phone: 0, tenant_id: scopedTenantId });
    }

    const jobs = contacts
      .map((contact) => {
        const to = normalizePhone(contact.phone_e164);
        if (!to) return null;

        const safeName = String(contact.name ?? "").trim() || "Irmão(ã)";
        const text = `Olá ${safeName}! Seja bem-vindo(a) ao CCM. ${groupLink ? `Entre no grupo: ${groupLink}` : ""}`.trim();

        return {
          tenant_id: scopedTenantId,
          contact_id: contact.id,
          channel: "whatsapp",
          type: "welcome",
          status: "PENDENTE",
          payload: {
            to,
            name: safeName,
            groupLink,
            templateName,
            mode,
            text,
            dispatchMode,
            testPhoneE164: dispatchMode === "TESTE" ? testPhone : null
          }
        };
      })
      .filter((item) => item !== null);

    const skippedInvalidPhone = contacts.length - jobs.length;

    if (!jobs.length) {
      return json({ queued: 0, skipped_invalid_phone: skippedInvalidPhone, tenant_id: scopedTenantId });
    }

    const { error: insertError } = await userClient.from("message_jobs").insert(jobs);
    if (insertError) {
      return json({ error: insertError.message }, { status: 400 });
    }

    return json({
      queued: jobs.length,
      skipped_invalid_phone: skippedInvalidPhone,
      tenant_id: scopedTenantId,
      mode,
      dispatch_mode: dispatchMode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("enqueue-welcome.unexpected", message);
    return json({ error: message }, { status: 500 });
  }
});
