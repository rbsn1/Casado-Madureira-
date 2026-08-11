import { type SupabaseClient } from "@supabase/supabase-js";
import { createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
import { parseBrazilPhone } from "@/lib/phone";
import { CULTO_ORIGEM_CCM_FORM_OPTIONS } from "@/lib/cultoOrigem";

export type AddFromGroupResult = {
  errorMessage: string | null;
  duplicate: boolean;
};

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export async function addFromGroup(
  client: SupabaseClient,
  input: { phone: string; name?: string }
): Promise<AddFromGroupResult> {
  const phoneParsed = parseBrazilPhone(input.phone);
  if (!phoneParsed) {
    return { errorMessage: "Informe o telefone com DDD. Ex: (92) 99227-0057.", duplicate: false };
  }

  const fallbackName = `Contato do grupo (${phoneParsed.formatted})`;
  const fullName = input.name?.trim() || fallbackName;
  const cultoOrigem = CULTO_ORIGEM_CCM_FORM_OPTIONS[0].value;

  const result = await createQuickCcmRegistration(client, {
    fullName,
    phoneWhatsapp: phoneParsed.formatted,
    registeredOn: currentLocalDateInputValue(),
    cultoOrigem,
    requestId: crypto.randomUUID()
  });

  return { errorMessage: result.errorMessage, duplicate: result.duplicate };
}
