"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

type MemberResult = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  has_active_case: boolean;
};

type EntryMode = "existing" | "new";

function isMissingCreateMemberFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("create_ccm_member_from_discipleship");
}

function isMissingMembersListFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("list_ccm_members_for_discipleship");
}

async function listMembersWithFallback() {
  if (!supabaseClient) {
    return { data: [] as MemberResult[], errorMessage: "Supabase não configurado." };
  }

  const batchSize = 500;
  const collectedMembers: MemberResult[] = [];
  let offset = 0;
  let listError: { message: string; code?: string } | null = null;

  while (true) {
    const { data: listData, error } = await supabaseClient.rpc("list_ccm_members_for_discipleship", {
      search_text: null,
      rows_limit: batchSize,
      rows_offset: offset
    });

    if (error) {
      listError = error;
      break;
    }

    const rows = Array.isArray(listData) ? listData : [];
    const normalizedRows = rows
      .map((row) => {
        const item = row as Partial<{
          member_id: string;
          member_name: string;
          member_phone: string | null;
          has_active_case: boolean;
        }>;
        if (!item.member_id || !item.member_name) return null;
        return {
          id: String(item.member_id),
          nome_completo: String(item.member_name),
          telefone_whatsapp: item.member_phone ?? null,
          has_active_case: Boolean(item.has_active_case)
        } as MemberResult;
      })
      .filter((item): item is MemberResult => item !== null);

    collectedMembers.push(...normalizedRows);
    if (normalizedRows.length < batchSize) break;
    offset += batchSize;
  }

  if (!listError) {
    return { data: collectedMembers, errorMessage: "" };
  }

  if (!isMissingMembersListFunctionError(listError.message, listError.code)) {
    return { data: [] as MemberResult[], errorMessage: listError.message };
  }

  const peopleRows: Array<{ id: string; nome_completo: string; telefone_whatsapp: string | null }> = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data: peopleData, error: peopleError } = await supabaseClient
      .from("pessoas")
      .select("id, nome_completo, telefone_whatsapp, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (peopleError) {
      return { data: [] as MemberResult[], errorMessage: peopleError.message };
    }

    const batch = Array.isArray(peopleData)
      ? (peopleData as Array<{ id: string; nome_completo: string; telefone_whatsapp: string | null }>)
      : [];

    peopleRows.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  if (!peopleRows.length) {
    return { data: [] as MemberResult[], errorMessage: "" };
  }

  const activeCaseMemberIds = new Set<string>();
  const memberIds = peopleRows.map((item) => item.id);
  for (let i = 0; i < memberIds.length; i += batchSize) {
    const chunk = memberIds.slice(i, i + batchSize);
    const { data: casesData, error: casesError } = await supabaseClient
      .from("discipleship_cases")
      .select("member_id")
      .in("member_id", chunk)
      .in("status", ["em_discipulado", "pausado"]);

    if (casesError) {
      return { data: [] as MemberResult[], errorMessage: casesError.message };
    }

    (casesData ?? []).forEach((item) => {
      if (item.member_id) activeCaseMemberIds.add(String(item.member_id));
    });
  }

  const fallbackData: MemberResult[] = peopleRows.map((member) => ({
    id: String(member.id),
    nome_completo: String(member.nome_completo),
    telefone_whatsapp: member.telefone_whatsapp ?? null,
    has_active_case: activeCaseMemberIds.has(String(member.id))
  }));

  return { data: fallbackData, errorMessage: "" };
}

export default function NovoConvertidoDiscipuladoPage() {
  const searchParams = useSearchParams();
  const [entryMode, setEntryMode] = useState<EntryMode>("existing");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberOrigin, setNewMemberOrigin] = useState("");
  const [newMemberChurch, setNewMemberChurch] = useState("");
  const [newMemberNeighborhood, setNewMemberNeighborhood] = useState("");
  const [newMemberObservations, setNewMemberObservations] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkScope() {
      const scope = await getAuthScope();
      if (!active) return;
      setHasAccess(
        scope.roles.includes("DISCIPULADOR") ||
          scope.roles.includes("SM_DISCIPULADO") ||
          scope.roles.includes("SECRETARIA_DISCIPULADO")
      );
    }

    checkScope();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!supabaseClient || !hasAccess || entryMode !== "existing") return;
      setMembersLoading(true);
      setMessage("");
      setStatus((prev) => (prev === "error" ? "idle" : prev));
      const { data, errorMessage } = await listMembersWithFallback();

      if (!active) return;
      if (errorMessage) {
        setMembers([]);
        setMessage(`Falha ao listar membros do CCM: ${errorMessage}`);
        setStatus("error");
        setMembersLoading(false);
        return;
      }
      const loadedMembers = (data ?? []) as MemberResult[];
      setMembers(loadedMembers);
      setMembersLoading(false);

      const memberId = searchParams.get("memberId");
      if (!memberId) return;
      const memberFromQuery = loadedMembers.find((item) => item.id === memberId);
      if (!memberFromQuery) return;
      if (memberFromQuery.has_active_case) {
        setStatus("error");
        setMessage("Este membro já possui case ativo.");
        return;
      }
      setSelectedMember(memberFromQuery);
    }

    loadMembers();
    return () => {
      active = false;
    };
  }, [entryMode, hasAccess, searchParams]);

  function resetForm(options?: { preserveFeedback?: boolean }) {
    setSelectedMember(null);
    setNewMemberName("");
    setNewMemberPhone("");
    setNewMemberOrigin("");
    setNewMemberChurch("");
    setNewMemberNeighborhood("");
    setNewMemberObservations("");
    setNotes("");
    if (!options?.preserveFeedback) {
      setMessage("");
      setStatus("idle");
    }
  }

  async function createCase(memberId: string) {
    if (!supabaseClient) return { ok: false as const, errorMessage: "Supabase não configurado." };

    const payload = {
      member_id: memberId,
      notes: notes.trim() || null,
      request_id: crypto.randomUUID()
    };
    const { error } = await supabaseClient.from("discipleship_cases").insert(payload);

    if (!error) {
      return { ok: true as const, errorMessage: "" };
    }

    if (error.code === "23505") {
      return { ok: false as const, errorMessage: "Já existe um case ativo para este membro." };
    }

    if (error.message === "not allowed") {
      return {
        ok: false as const,
        errorMessage:
          "Permissão insuficiente neste ambiente para concluir a operação. Aplique a migração 0032_discipulado_sm_criticality_on_insert.sql."
      };
    }

    return { ok: false as const, errorMessage: error.message };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;

    setStatus("loading");
    setMessage("");

    if (entryMode === "existing") {
      if (!selectedMember) return;
      const caseResult = await createCase(selectedMember.id);
      if (!caseResult.ok) {
        setStatus("error");
        setMessage(caseResult.errorMessage);
        return;
      }

      setStatus("success");
      setMessage("Novo convertido cadastrado com sucesso.");
      setMembers((prev) =>
        prev.map((item) => (item.id === selectedMember.id ? { ...item, has_active_case: true } : item))
      );
      resetForm({ preserveFeedback: true });
      return;
    }

    const normalizedName = newMemberName.trim();
    if (normalizedName.length < 3) {
      setStatus("error");
      setMessage("Informe o nome completo com ao menos 3 caracteres.");
      return;
    }

    const parsedPhone = parseBrazilPhone(newMemberPhone);
    if (!parsedPhone) {
      setStatus("error");
      setMessage("Informe o telefone com DDD. Ex: (92) 99227-0057.");
      return;
    }

    if (newMemberNeighborhood.trim() && newMemberNeighborhood.trim().length < 2) {
      setStatus("error");
      setMessage("O bairro precisa ter ao menos 2 caracteres.");
      return;
    }

    const { data: createdData, error: createMemberError } = await supabaseClient.rpc(
      "create_ccm_member_from_discipleship",
      {
        full_name: normalizedName,
        phone_whatsapp: parsedPhone.formatted,
        origin: newMemberOrigin.trim() || null,
        origin_church: newMemberChurch.trim() || null,
        neighborhood: newMemberNeighborhood.trim() || null,
        notes: newMemberObservations.trim() || null
      }
    );

    if (createMemberError) {
      if (isMissingCreateMemberFunctionError(createMemberError.message, createMemberError.code)) {
        setStatus("error");
        setMessage(
          "Cadastro de membro no Discipulado indisponível neste ambiente. Aplique a migração 0033_discipulado_formulario_cadastro_ccm.sql."
        );
        return;
      }
      setStatus("error");
      setMessage(createMemberError.message);
      return;
    }

    const rows = Array.isArray(createdData) ? createdData : [];
    const firstRow = rows[0] as Partial<{ member_id: string }> | undefined;
    const createdMemberId = firstRow?.member_id ? String(firstRow.member_id) : "";
    if (!createdMemberId) {
      setStatus("error");
      setMessage("Não foi possível confirmar o membro cadastrado no CCM.");
      return;
    }

    const caseResult = await createCase(createdMemberId);
    if (!caseResult.ok) {
      setStatus("error");
      setMessage(caseResult.errorMessage);
      return;
    }

    setStatus("success");
    setMessage("Membro cadastrado no CCM e case de discipulado criado com sucesso.");
    resetForm({ preserveFeedback: true });
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito aos perfis DISCIPULADOR, SM_DISCIPULADO e SECRETARIA_DISCIPULADO.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Novo convertido</h2>
        <p className="mt-1 text-sm text-slate-600">
          Selecione um membro da lista do CCM ou faça o cadastro direto no formulário do Discipulado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="discipulado-panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEntryMode("existing");
              setMessage("");
              setStatus("idle");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              entryMode === "existing"
                ? "bg-sky-700 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-900"
            }`}
          >
            Selecionar do CCM
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode("new");
              setSelectedMember(null);
              setMessage("");
              setStatus("idle");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              entryMode === "new"
                ? "bg-sky-700 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-900"
            }`}
          >
            Cadastrar no Discipulado
          </button>
        </div>

        {entryMode === "existing" ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-700">Lista de membros (CCM)</span>
              <select
                value={selectedMember?.id ?? ""}
                onChange={(event) => {
                  const member = members.find((item) => item.id === event.target.value) ?? null;
                  setSelectedMember(member);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                disabled={membersLoading || !members.length}
              >
                <option value="">
                  {membersLoading ? "Carregando membros..." : "Selecione um membro"}
                </option>
                {members
                  .filter((item) => !item.has_active_case)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nome_completo} {member.telefone_whatsapp ? `(${member.telefone_whatsapp})` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-500">
                Total no CCM: {members.length} • disponíveis para novo case:{" "}
                {members.filter((item) => !item.has_active_case).length} • já com case ativo:{" "}
                {members.filter((item) => item.has_active_case).length}
              </p>
            </label>

            {!membersLoading && !members.length ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Nenhum membro encontrado no CCM para sua congregação.
              </p>
            ) : null}

            {selectedMember ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm text-sky-900">
                Selecionado: <strong>{selectedMember.nome_completo}</strong> ({selectedMember.telefone_whatsapp ?? "-"})
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Nome completo</span>
              <input
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Digite o nome completo"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Telefone (WhatsApp)</span>
              <input
                value={newMemberPhone}
                onChange={(event) => setNewMemberPhone(formatBrazilPhoneInput(event.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="(92) 99227-0057"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Origem</span>
              <input
                value={newMemberOrigin}
                onChange={(event) => setNewMemberOrigin(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Culto, célula, evento..."
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Igreja de origem</span>
              <input
                value={newMemberChurch}
                onChange={(event) => setNewMemberChurch(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Ex.: Sede"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Bairro</span>
              <input
                value={newMemberNeighborhood}
                onChange={(event) => setNewMemberNeighborhood(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Bairro"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-700">Observações do cadastro (CCM)</span>
              <textarea
                value={newMemberObservations}
                onChange={(event) => setNewMemberObservations(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Informações do cadastro do membro"
              />
            </label>
          </div>
        )}

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Observações iniciais do case</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            placeholder="Informações pastorais e de acompanhamento"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={status === "loading" || (entryMode === "existing" && !selectedMember)}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading"
              ? "Salvando..."
              : entryMode === "existing"
                ? "Criar case"
                : "Cadastrar e criar case"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-900"
          >
            Cancelar
          </button>
        </div>

        {message ? (
          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              status === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
