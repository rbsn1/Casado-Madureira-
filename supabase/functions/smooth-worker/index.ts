import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type MessageJobRow = {
  id: string;
  tenant_id: string;
  contact_id: string;
  status: "PENDENTE" | "ENVIADO" | "ERRO";
  payload: Record<string, unknown> | null;
  attempts: number;
};

type ContactRow = {
  id: string;
  name: string;
  phone_e164: string;
  opt_in_whatsapp: boolean;
};

type DispatchMode = "TESTE" | "PRODUCAO";
type MessageMode = "template" | "text";

type JobPayload = {
  to?: string;
  name?: string;
  text?: string;
  groupLink?: string;
  templateName?: string;
  mode?: MessageMode;
  dispatchMode?: DispatchMode;
  testPhoneE164?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
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

function parsePayload(payload: Record<string, unknown> | null): JobPayload {
  if (!payload || typeof payload !== "object") return {};
  return payload as JobPayload;
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
    const workerToken = getRequiredEnv("WORKER_TOKEN");
    const suppliedToken = req.headers.get("x-worker-token") ?? req.headers.get("X-WORKER-TOKEN") ?? "";
    if (suppliedToken !== workerToken) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const whatsappToken = getRequiredEnv("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = getRequiredEnv("WHATSAPP_PHONE_NUMBER_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v22.0";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const nowIso = new Date().toISOString();
    const { data: jobsData, error: jobsError } = await supabase
      .from("message_jobs")
      .select("id, tenant_id, contact_id, status, payload, attempts")
      .eq("status", "PENDENTE")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (jobsError) {
      console.error("smooth-worker.jobs.fetch", jobsError);
      return json({ error: jobsError.message }, { status: 500 });
    }

    const jobs = (jobsData ?? []) as MessageJobRow[];
    if (!jobs.length) {
      return json({ processed: 0, sent: 0, failed: 0 });
    }

    const contactIds = [...new Set(jobs.map((job) => job.contact_id))];
    const { data: contactsData, error: contactsError } = await supabase
      .from("contacts")
      .select("id, name, phone_e164, opt_in_whatsapp")
      .in("id", contactIds);

    if (contactsError) {
      console.error("smooth-worker.contacts.fetch", contactsError);
      return json({ error: contactsError.message }, { status: 500 });
    }

    const contacts = (contactsData ?? []) as ContactRow[];
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const job of jobs) {
      processed += 1;
      const payload = parsePayload(job.payload);
      const contact = contactsById.get(job.contact_id);

      try {
        if (!contact) {
          throw new Error("Contact not found");
        }

        if (!contact.opt_in_whatsapp) {
          throw new Error("Contact has no WhatsApp opt-in");
        }

        const dispatchMode: DispatchMode = payload.dispatchMode === "TESTE" ? "TESTE" : "PRODUCAO";
        const fallbackTo = normalizePhone(contact.phone_e164);
        const originalTo = normalizePhone(payload.to ?? fallbackTo);
        const testPhone = normalizePhone(payload.testPhoneE164 ?? "");
        const to = dispatchMode === "TESTE" && testPhone ? testPhone : originalTo;

        if (!to) {
          throw new Error("Invalid destination phone");
        }

        const mode: MessageMode = payload.mode === "template" ? "template" : "text";
        const name = String(payload.name ?? contact.name ?? "").trim() || "Irmão(ã)";
        const groupLink = String(payload.groupLink ?? "").trim();
        const templateName = String(payload.templateName ?? "welcome_ccm").trim() || "welcome_ccm";
        const fallbackText = `Olá ${name}! Seja bem-vindo(a) ao CCM. ${groupLink ? `Entre no grupo: ${groupLink}` : ""}`.trim();
        const textBody = String(payload.text ?? fallbackText).trim() || fallbackText;

        // Template and text share the same provider endpoint; only body shape changes.
        const providerPayload = mode === "template"
          ? {
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: templateName,
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: name },
                      { type: "text", text: groupLink }
                    ]
                  }
                ]
              }
            }
          : {
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: textBody }
            };

        const providerResponse = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${whatsappToken}`
            },
            body: JSON.stringify(providerPayload)
          }
        );

        const providerJson = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) {
          throw new Error(JSON.stringify(providerJson));
        }

        const providerMessageId =
          Array.isArray((providerJson as Record<string, unknown>).messages) &&
          (providerJson as Record<string, unknown>).messages.length > 0
            ? String(((providerJson as Record<string, unknown>).messages as Array<Record<string, unknown>>)[0]?.id ?? "")
            : null;

        const { error: updateSuccessError } = await supabase
          .from("message_jobs")
          .update({
            status: "ENVIADO",
            provider_message_id: providerMessageId,
            sent_at: new Date().toISOString(),
            last_error: null
          })
          .eq("id", job.id);

        if (updateSuccessError) {
          throw new Error(updateSuccessError.message);
        }

        sent += 1;
      } catch (error) {
        const nextAttempts = (job.attempts ?? 0) + 1;
        const shouldStop = nextAttempts >= 3;
        const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const normalizedError = error instanceof Error ? error.message : JSON.stringify(error);

        const { error: updateFailureError } = await supabase
          .from("message_jobs")
          .update({
            attempts: nextAttempts,
            last_error: normalizedError,
            status: shouldStop ? "ERRO" : "PENDENTE",
            scheduled_at: shouldStop ? nowIso : retryAt
          })
          .eq("id", job.id);

        if (updateFailureError) {
          console.error("smooth-worker.job.update_failure", {
            jobId: job.id,
            error: updateFailureError.message
          });
        }

        failed += 1;
      }
    }

    return json({ processed, sent, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("smooth-worker.unexpected", message);
    return json({ error: message }, { status: 500 });
  }
});
