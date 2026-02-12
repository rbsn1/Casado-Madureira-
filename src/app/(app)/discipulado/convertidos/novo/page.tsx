"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type MemberResult = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  has_active_case: boolean;
};

function isMissingSearchMembersFunctionError(message: string, code?: string) {
  return code === "PGRST202" || message.includes("search_ccm_members_for_discipleship");
}

async function searchMembersWithFallback(term: string) {
  if (!supabaseClient) {
    return { data: [] as MemberResult[], errorMessage: "Supabase não configurado." };
  }

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc("search_ccm_members_for_discipleship", {
    search_text: term,
    rows_limit: 8,
    target_congregation_id: null
  });

  if (!rpcError) {
    return { data: (rpcData ?? []) as MemberResult[], errorMessage: "" };
  }

  if (!isMissingSearchMembersFunctionError(rpcError.message, rpcError.code)) {
    return { data: [] as MemberResult[], errorMessage: rpcError.message };
  }

  const { data: peopleData, error: peopleError } = await supabaseClient
    .from("pessoas")
    .select("id, nome_completo, telefone_whatsapp")
    .or(`nome_completo.ilike.%${term}%,telefone_whatsapp.ilike.%${term}%`)
    .order("nome_completo", { ascending: true })
    .limit(8);

  if (peopleError) {
    return { data: [] as MemberResult[], errorMessage: peopleError.message };
  }

  const members = (peopleData ?? []) as { id: string; nome_completo: string; telefone_whatsapp: string | null }[];
  if (!members.length) {
    return { data: [] as MemberResult[], errorMessage: "" };
  }

  const memberIds = members.map((item) => item.id);
  const { data: casesData, error: casesError } = await supabaseClient
    .from("discipleship_cases")
    .select("member_id, status")
    .in("member_id", memberIds)
    .in("status", ["em_discipulado", "pausado"]);

  if (casesError) {
    return { data: [] as MemberResult[], errorMessage: casesError.message };
  }

  const activeCaseMembers = new Set((casesData ?? []).map((item) => item.member_id));
  const fallbackData: MemberResult[] = members.map((member) => ({
    id: member.id,
    nome_completo: member.nome_completo,
    telefone_whatsapp: member.telefone_whatsapp,
    has_active_case: activeCaseMembers.has(member.id)
  }));

  return { data: fallbackData, errorMessage: "" };
}

export default function NovoConvertidoDiscipuladoPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkScope() {
      const scope = await getAuthScope();
      if (!active) return;
      setHasAccess(scope.roles.includes("DISCIPULADOR") || scope.roles.includes("SM_DISCIPULADO"));
    }

    checkScope();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrateFromQuery() {
      if (!supabaseClient || !hasAccess) return;
      const memberId = searchParams.get("memberId");
      if (!memberId || selectedMember) return;

      const [{ data: person, error: personError }, { data: activeCases, error: casesError }] = await Promise.all([
        supabaseClient
          .from("pessoas")
          .select("id, nome_completo, telefone_whatsapp")
          .eq("id", memberId)
          .single(),
        supabaseClient
          .from("discipleship_cases")
          .select("id")
          .eq("member_id", memberId)
          .in("status", ["em_discipulado", "pausado"])
          .limit(1)
      ]);

      if (!active) return;

      if (personError) {
        setStatus("error");
        setMessage(personError.message);
        return;
      }
      if (casesError) {
        setStatus("error");
        setMessage(casesError.message);
        return;
      }
      if ((activeCases ?? []).length > 0) {
        setStatus("error");
        setMessage("Este membro já possui case ativo.");
        return;
      }

      const member: MemberResult = {
        id: String(person.id),
        nome_completo: String(person.nome_completo),
        telefone_whatsapp: person.telefone_whatsapp ?? null,
        has_active_case: false
      };
      setSelectedMember(member);
      setQuery(member.nome_completo);
    }

    hydrateFromQuery();
    return () => {
      active = false;
    };
  }, [hasAccess, searchParams, selectedMember]);

  useEffect(() => {
    let active = true;

    async function searchMembers() {
      const term = query.trim();
      if (!supabaseClient || selectedMember) {
        return;
      }
      if (term.length < 2) {
        if (active) {
          setMembers([]);
          if (status === "error") {
            setStatus("idle");
            setMessage("");
          }
        }
        return;
      }

      const { data, errorMessage } = await searchMembersWithFallback(term);

      if (!active) return;
      if (errorMessage) {
        setMembers([]);
        setMessage(`Falha ao buscar membros do CCM: ${errorMessage}`);
        setStatus("error");
        return;
      }
      setMembers((data ?? []) as MemberResult[]);
    }

    const timeout = window.setTimeout(searchMembers, 260);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query, selectedMember, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !selectedMember) return;

    setStatus("loading");
    setMessage("");
    const payload = {
      member_id: selectedMember.id,
      notes: notes.trim() || null,
      request_id: crypto.randomUUID()
    };
    const { error } = await supabaseClient.from("discipleship_cases").insert(payload);

    if (error) {
      if (error.code === "23505") {
        setStatus("error");
        setMessage("Já existe um case ativo para este membro.");
        return;
      }
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Novo convertido cadastrado com sucesso.");
    setSelectedMember(null);
    setQuery("");
    setMembers([]);
    setNotes("");
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito aos perfis DISCIPULADOR e SM_DISCIPULADO.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-sky-700">Discipulado</p>
        <h2 className="text-xl font-semibold text-sky-950">Novo convertido</h2>
        <p className="mt-1 text-sm text-slate-600">
          Selecione um membro já cadastrado no CCM para iniciar o discipulado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="discipulado-panel space-y-4 p-5">
        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Buscar membro (CCM)</span>
          <input
            value={selectedMember ? selectedMember.nome_completo : query}
            onChange={(event) => {
              setSelectedMember(null);
              setQuery(event.target.value);
            }}
            placeholder="Digite nome ou sobrenome"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
          {!selectedMember && query.trim().length > 0 && query.trim().length < 2 ? (
            <p className="text-xs text-slate-500">Digite ao menos 2 caracteres para buscar.</p>
          ) : null}
        </label>

        {!selectedMember && members.length ? (
          <div className="rounded-lg border border-slate-100 bg-white p-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                disabled={member.has_active_case}
                onClick={() => {
                  setSelectedMember(member);
                  setQuery(member.nome_completo);
                  setMembers([]);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="font-medium text-slate-900">{member.nome_completo}</span>
                <span className="text-right text-xs text-slate-600">
                  {member.telefone_whatsapp ?? "-"}
                  {member.has_active_case ? (
                    <span className="mt-1 block font-semibold text-amber-700">Case ativo</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedMember ? (
          <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm text-sky-900">
            Selecionado: <strong>{selectedMember.nome_completo}</strong> ({selectedMember.telefone_whatsapp ?? "-"})
          </div>
        ) : null}

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Observações iniciais</span>
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
            disabled={status === "loading" || !selectedMember}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading" ? "Salvando..." : "Criar case"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedMember(null);
              setQuery("");
              setMembers([]);
              setNotes("");
              setMessage("");
              setStatus("idle");
            }}
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
