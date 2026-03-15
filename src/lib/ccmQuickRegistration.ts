import { type SupabaseClient } from "@supabase/supabase-js";
import { CultoOrigemCode, cultoOrigemToLegacyOrigem } from "@/lib/cultoOrigem";

type SupabaseLikeError = {
  message: string;
  code?: string;
};

type QuickCcmRegistrationRow = {
  member_id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  congregation_id: string;
  cadastro_completo_status: string;
};

type FullCcmRegistrationRow = QuickCcmRegistrationRow;

export type QuickCcmRegistrationInput = {
  fullName: string;
  phoneWhatsapp: string;
  registeredOn: string;
  cultoOrigem: CultoOrigemCode;
  requestId?: string;
};

export type QuickCcmRegistrationResult = {
  data: QuickCcmRegistrationRow | null;
  duplicate: boolean;
  errorMessage: string | null;
};

export type FullCcmRegistrationInput = {
  fullName: string;
  phoneWhatsapp: string;
  registeredOn: string;
  cultoOrigem: CultoOrigemCode;
  cpfDigits: string;
  rg: string;
  originChurch?: string;
  neighborhood?: string;
  photoUrl?: string;
  birthDate?: string;
  email?: string;
  address?: string;
  notes?: string;
  requestId?: string;
  allowDirectInsertFallback?: boolean;
};

export type FullCcmRegistrationResult = {
  data: FullCcmRegistrationRow | null;
  duplicate: boolean;
  errorMessage: string | null;
};

function isMissingQuickRegistrationRpcError(message: string | undefined, code?: string) {
  if (!message) return false;
  return code === "PGRST202" || message.includes("create_quick_ccm_registration");
}

function isMissingFullRegistrationRpcError(message: string | undefined, code?: string) {
  if (!message) return false;
  return code === "PGRST202" || message.includes("create_full_ccm_registration");
}

function isMissingColumnError(message: string, code: string | undefined, column: string) {
  return code === "PGRST204" && message.includes(column);
}

function isDuplicateQuickRegistrationError(error: SupabaseLikeError | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "23505" ||
    message.includes("Já existe cadastro com este telefone nesta congregação.") ||
    message.includes("duplicate key value violates unique constraint")
  );
}

function getQuickRegistrationErrorMessage(error: SupabaseLikeError | null | undefined) {
  const message = error?.message ?? "";

  if (!message) {
    return "Não foi possível salvar o cadastro rápido.";
  }

  if (message === "not allowed") {
    return "Seu perfil não tem permissão para cadastrar neste fluxo.";
  }

  if (message === "congregation inactive") {
    return "Seu usuário não está vinculado a uma congregação ativa.";
  }

  if (message.includes("row-level security policy")) {
    return "Este ambiente ainda não liberou o cadastro rápido para o perfil CADASTRADOR. Aplique a migração 0068_ccm_quick_registration_rpc.sql.";
  }

  return message;
}

function getFullRegistrationErrorMessage(error: SupabaseLikeError | null | undefined) {
  const message = error?.message ?? "";

  if (!message) {
    return "Não foi possível salvar o cadastro completo.";
  }

  if (message === "not allowed") {
    return "Seu perfil não tem permissão para usar o formulário completo.";
  }

  if (message === "congregation inactive") {
    return "Seu usuário não está vinculado a uma congregação ativa.";
  }

  if (message.includes("row-level security policy")) {
    return "Este ambiente ainda não liberou o formulário completo para este perfil. Aplique a migração 0069_ccm_full_registration_rpc.sql.";
  }

  if (message.includes("create_full_ccm_registration")) {
    return "Aplique a migração 0069_ccm_full_registration_rpc.sql para habilitar o formulário completo.";
  }

  return message;
}

export async function createQuickCcmRegistration(
  supabase: SupabaseClient,
  input: QuickCcmRegistrationInput
): Promise<QuickCcmRegistrationResult> {
  const rpcRequestId = input.requestId ?? null;
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_quick_ccm_registration", {
    full_name: input.fullName,
    phone_whatsapp: input.phoneWhatsapp,
    registered_on: input.registeredOn,
    service_origin: input.cultoOrigem,
    request_id: rpcRequestId
  });

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? ((rpcData[0] ?? null) as QuickCcmRegistrationRow | null) : null;
    return {
      data: row,
      duplicate: false,
      errorMessage: null
    };
  }

  if (!isMissingQuickRegistrationRpcError(rpcError.message, rpcError.code)) {
    const duplicate = isDuplicateQuickRegistrationError(rpcError);
    return {
      data: null,
      duplicate,
      errorMessage: duplicate ? null : getQuickRegistrationErrorMessage(rpcError)
    };
  }

  let insertPayload: Record<string, unknown> = {
    nome_completo: input.fullName,
    telefone_whatsapp: input.phoneWhatsapp,
    data: input.registeredOn,
    origem: cultoOrigemToLegacyOrigem(input.cultoOrigem),
    culto_origem: input.cultoOrigem,
    cadastro_origem: "ccm",
    cadastro_completo_status: "pendente",
    request_id: rpcRequestId
  };

  let { error } = await supabase.from("pessoas").insert(insertPayload);

  if (error && isMissingColumnError(error.message, error.code, "request_id")) {
    const { request_id: _requestId, ...fallbackPayload } = insertPayload;
    insertPayload = fallbackPayload;
    ({ error } = await supabase.from("pessoas").insert(insertPayload));
  }

  if (error && isMissingColumnError(error.message, error.code, "culto_origem")) {
    const { culto_origem: _cultoOrigem, ...fallbackPayload } = insertPayload;
    insertPayload = fallbackPayload;
    ({ error } = await supabase.from("pessoas").insert(insertPayload));
  }

  if (error && isMissingColumnError(error.message, error.code, "cadastro_completo_status")) {
    return {
      data: null,
      duplicate: false,
      errorMessage: "Aplique a migração 0020_member_profile_completion.sql para marcar o cadastro como pendente."
    };
  }

  if (error) {
    const duplicate = isDuplicateQuickRegistrationError(error);
    return {
      data: null,
      duplicate,
      errorMessage: duplicate ? null : getQuickRegistrationErrorMessage(error)
    };
  }

  return {
    data: null,
    duplicate: false,
    errorMessage: null
  };
}

export async function createFullCcmRegistration(
  supabase: SupabaseClient,
  input: FullCcmRegistrationInput
): Promise<FullCcmRegistrationResult> {
  const rpcRequestId = input.requestId ?? null;
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_full_ccm_registration", {
    full_name: input.fullName,
    phone_whatsapp: input.phoneWhatsapp,
    registered_on: input.registeredOn,
    service_origin: input.cultoOrigem,
    cpf_text: input.cpfDigits,
    rg_text: input.rg,
    origin_church: input.originChurch?.trim() || null,
    neighborhood_text: input.neighborhood?.trim() || null,
    photo_url_text: input.photoUrl?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    email_text: input.email?.trim() || null,
    address_text: input.address?.trim() || null,
    notes_text: input.notes?.trim() || null,
    request_id: rpcRequestId
  });

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? ((rpcData[0] ?? null) as FullCcmRegistrationRow | null) : null;
    return {
      data: row,
      duplicate: false,
      errorMessage: null
    };
  }

  if (!isMissingFullRegistrationRpcError(rpcError.message, rpcError.code)) {
    const duplicate = isDuplicateQuickRegistrationError(rpcError);
    return {
      data: null,
      duplicate,
      errorMessage: duplicate ? null : getFullRegistrationErrorMessage(rpcError)
    };
  }

  if (!input.allowDirectInsertFallback) {
    return {
      data: null,
      duplicate: false,
      errorMessage: "Aplique a migração 0069_ccm_full_registration_rpc.sql para habilitar o formulário completo."
    };
  }

  let insertPayload: Record<string, unknown> = {
    nome_completo: input.fullName,
    telefone_whatsapp: input.phoneWhatsapp,
    data: input.registeredOn,
    origem: cultoOrigemToLegacyOrigem(input.cultoOrigem),
    culto_origem: input.cultoOrigem,
    cadastro_origem: "ccm",
    cadastro_completo_status: "concluido",
    cadastro_completo_at: new Date().toISOString(),
    cpf: input.cpfDigits,
    rg: input.rg.trim(),
    igreja_origem: input.originChurch?.trim() || null,
    bairro: input.neighborhood?.trim() || null,
    foto_url: input.photoUrl?.trim() || null,
    data_nascimento: input.birthDate?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    endereco: input.address?.trim() || null,
    observacoes: input.notes?.trim() || null,
    request_id: rpcRequestId
  };

  let { error } = await supabase.from("pessoas").insert(insertPayload);

  if (error && isMissingColumnError(error.message, error.code, "request_id")) {
    const { request_id: _requestId, ...fallbackPayload } = insertPayload;
    insertPayload = fallbackPayload;
    ({ error } = await supabase.from("pessoas").insert(insertPayload));
  }

  if (error && isMissingColumnError(error.message, error.code, "culto_origem")) {
    const { culto_origem: _cultoOrigem, ...fallbackPayload } = insertPayload;
    insertPayload = fallbackPayload;
    ({ error } = await supabase.from("pessoas").insert(insertPayload));
  }

  if (
    error &&
    [
      "cadastro_completo_status",
      "cadastro_completo_at",
      "cpf",
      "rg",
      "foto_url",
      "email",
      "data_nascimento",
      "endereco"
    ].some((column) => isMissingColumnError(error.message, error.code, column))
  ) {
    return {
      data: null,
      duplicate: false,
      errorMessage: "Aplique a migração 0020_member_profile_completion.sql para habilitar o formulário completo."
    };
  }

  if (error) {
    const duplicate = isDuplicateQuickRegistrationError(error);
    return {
      data: null,
      duplicate,
      errorMessage: duplicate ? null : getFullRegistrationErrorMessage(error)
    };
  }

  return {
    data: null,
    duplicate: false,
    errorMessage: null
  };
}
