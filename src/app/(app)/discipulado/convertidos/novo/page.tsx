"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type MemberResult = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
};

export default function NovoConvertidoDiscipuladoPage() {
  const router = useRouter();
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
      setHasAccess(scope.roles.includes("ADMIN_MASTER") || scope.roles.includes("DISCIPULADOR"));
    }

    checkScope();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function searchMembers() {
      if (!supabaseClient || !query.trim() || selectedMember) {
        if (active && !query.trim()) setMembers([]);
        return;
      }

      const { data, error } = await supabaseClient
        .from("pessoas")
        .select("id, nome_completo, telefone_whatsapp")
        .ilike("nome_completo", `%${query.trim()}%`)
        .order("nome_completo")
        .limit(8);

      if (!active) return;
      if (error) {
        setMembers([]);
        setMessage(error.message);
        setStatus("error");
        return;
      }
      setMembers((data ?? []) as MemberResult[]);
    }

    const timeout = window.setTimeout(searchMembers, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query, selectedMember]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !selectedMember) return;

    setStatus("loading");
    setMessage("");

    const { data, error } = await supabaseClient
      .from("discipleship_cases")
      .insert({
        member_id: selectedMember.id,
        notes: notes.trim() || null,
        request_id: crypto.randomUUID()
      })
      .select("id")
      .single();

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
    setMessage("Case de discipulado criado com sucesso.");
    router.push(`/discipulado/convertidos/${data.id}`);
  }

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito ao perfil de discipulador e administradores.
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
        </label>

        {!selectedMember && members.length ? (
          <div className="rounded-lg border border-slate-100 bg-white p-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setSelectedMember(member);
                  setQuery(member.nome_completo);
                  setMembers([]);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-sky-50"
              >
                <span className="font-medium text-slate-900">{member.nome_completo}</span>
                <span className="text-xs text-slate-600">{member.telefone_whatsapp ?? "-"}</span>
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
            onClick={() => router.push("/discipulado/convertidos")}
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
