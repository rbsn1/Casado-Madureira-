import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EnqueueBody = {
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
  mode?: "template" | "text";
  dispatch_mode?: "TESTE" | "PRODUCAO";
  test_phone_e164?: string;
};

type ActiveRoleRow = {
  role: string;
  congregation_id?: string | null;
  created_at?: string;
};

type ChurchSettingsRow = {
  whatsapp_group_link: string | null;
  welcome_template_name: string;
  welcome_enabled: boolean;
};

type ContactRow = {
  id: string;
  name: string;
  phone_e164: string;
};

const ALLOWED_ROLES = new Set(["ADMIN_MASTER", "SUPER_ADMIN", "SECRETARIA"]);

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\D+/g, "");
}

function normalizeBrazilE164(value: unknown) {
  const digits = normalizePhone(value);
  if (!digits) return "";

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "server_misconfigured: missing supabase anon env vars" },
      { status: 500 }
    );
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: { persistSession: false }
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  let activeRoles: ActiveRoleRow[] = [];
  let rolesError: { message?: string } | null = null;

  const rolesWithCongregation = await (supabaseAdmin as any)
    .from("usuarios_perfis")
    .select("role, congregation_id, created_at")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  activeRoles = (rolesWithCongregation.data ?? []) as ActiveRoleRow[];
  rolesError = rolesWithCongregation.error as { message?: string } | null;

  if (rolesError?.message?.toLowerCase().includes("congregation_id")) {
    const fallbackRoles = await (supabaseAdmin as any)
      .from("usuarios_perfis")
      .select("role, created_at")
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    activeRoles = (fallbackRoles.data ?? []) as ActiveRoleRow[];
    rolesError = fallbackRoles.error as { message?: string } | null;
  }

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message ?? "Erro ao carregar papéis." }, { status: 500 });
  }

  const roles = activeRoles.map((item) => item.role);
  const canEnqueue = roles.some((role) => ALLOWED_ROLES.has(role));
  if (!canEnqueue) {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
  }

  const isGlobalAdmin = roles.includes("SUPER_ADMIN") || roles.includes("ADMIN_MASTER");
  const congregationId = activeRoles.find((item) => item.congregation_id)?.congregation_id ?? null;

  const body = (await request.json().catch(() => ({}))) as EnqueueBody;
  const tenantId = body.tenant_id?.trim() ?? "";
  const dateFrom = body.date_from?.trim() ?? "";
  const dateTo = body.date_to?.trim() ?? "";

  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return NextResponse.json(
      { error: "date_from/date_to devem estar no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (new Date(`${dateFrom}T00:00:00Z`) > new Date(`${dateTo}T23:59:59Z`)) {
    return NextResponse.json({ error: "date_from não pode ser maior que date_to" }, { status: 400 });
  }

  const scopedTenantId = tenantId || congregationId || "";
  if (!scopedTenantId) {
    return NextResponse.json({ error: "Não foi possível resolver tenant_id" }, { status: 400 });
  }

  if (!isGlobalAdmin && scopedTenantId !== congregationId) {
    return NextResponse.json({ error: "tenant_id fora do escopo do usuário" }, { status: 403 });
  }

  const dispatchMode = body.dispatch_mode === "TESTE" ? "TESTE" : "PRODUCAO";
  const testPhone = normalizeBrazilE164(body.test_phone_e164 ?? "");
  if (dispatchMode === "TESTE" && !testPhone) {
    return NextResponse.json({ error: "No modo TESTE, informe test_phone_e164" }, { status: 400 });
  }

  const requestedMode = body.mode === "text" ? "text" : body.mode === "template" ? "template" : null;

  const { data: settingsData, error: settingsError } = await supabaseAdmin
    .from("church_settings")
    .select("whatsapp_group_link, welcome_template_name, welcome_enabled")
    .eq("tenant_id", scopedTenantId)
    .maybeSingle();

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 400 });
  }

  const settings = settingsData as ChurchSettingsRow | null;
  if (settings && !settings.welcome_enabled) {
    return NextResponse.json({ error: "Boas-vindas desativadas para este tenant" }, { status: 400 });
  }

  const groupLink = settings?.whatsapp_group_link?.trim() || "";
  const templateName = settings?.welcome_template_name?.trim() || "welcome_ccm";
  const defaultMode: "template" | "text" = templateName ? "template" : "text";
  const mode = requestedMode ?? defaultMode;

  const startIso = `${dateFrom}T00:00:00.000Z`;
  const endIso = `${dateTo}T23:59:59.999Z`;

  const { data: contactsData, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("id, name, phone_e164")
    .eq("tenant_id", scopedTenantId)
    .eq("opt_in_whatsapp", true)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });

  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 400 });
  }

  const contacts = (contactsData ?? []) as ContactRow[];
  if (!contacts.length) {
    return NextResponse.json({ queued: 0, skipped_invalid_phone: 0, tenant_id: scopedTenantId });
  }

  const jobs = contacts
    .map((contact) => {
      const to = normalizeBrazilE164(contact.phone_e164);
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
    return NextResponse.json({ queued: 0, skipped_invalid_phone: skippedInvalidPhone, tenant_id: scopedTenantId });
  }

  const { error: insertError } = await (supabaseAdmin as any)
    .from("message_jobs")
    .insert(jobs as any[]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({
    queued: jobs.length,
    skipped_invalid_phone: skippedInvalidPhone,
    tenant_id: scopedTenantId,
    mode,
    dispatch_mode: dispatchMode
  });
}
