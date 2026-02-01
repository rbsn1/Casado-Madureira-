"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PublicDept = {
  id: string;
  nome: string;
  responsavel: string | null;
  contato: string | null;
  ativo: boolean;
};

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    from: "bot",
    text: "Ola! Quer entrar em algum departamento? Diga o nome e eu informo quem procurar."
  }
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function matchDepartment(departments: PublicDept[], input: string) {
  const normalized = normalizeText(input);
  if (!normalized) return null;
  const candidates = departments.filter((dept) => dept.ativo);
  const direct = candidates.find((dept) => normalizeText(dept.nome).includes(normalized));
  if (direct) return direct;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return candidates.find((dept) => words.some((word) => normalizeText(dept.nome).includes(word))) ?? null;
}

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [departments, setDepartments] = useState<PublicDept[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("departamentos_publicos")
        .select("id, nome, responsavel, contato, ativo")
        .eq("ativo", true)
        .order("nome");
      if (!active) return;
      if (error) return;
      setDepartments((data ?? []) as PublicDept[]);
    }

    if (open) {
      loadDepartments();
    }

    return () => {
      active = false;
    };
  }, [open]);

  const canSend = useMemo(() => input.trim().length > 1, [input]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const value = input.trim();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id, from: "user", text: value }]);
    setInput("");
    setLoading(true);

    const match = matchDepartment(departments, value);
    if (match) {
      const contact = match.contato ? `Contato: ${match.contato}` : "Contato: secretaria do CCM.";
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-bot`,
          from: "bot",
          text: `Para o departamento ${match.nome}, procure ${match.responsavel ?? "o(a) responsavel"}.\n${contact}`
        }
      ]);
      setLoading(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${id}-bot`,
        from: "bot",
        text: "Nao encontrei esse departamento. Informe o nome completo ou fale com a secretaria para direcionamento."
      }
    ]);
    setLoading(false);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[320px] overflow-hidden rounded-2xl border border-black/10 bg-white/90 shadow-2xl shadow-black/10 backdrop-blur-lg">
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ajuda CCM</p>
              <p className="text-sm font-semibold text-emerald-900">Chat de departamentos</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Fechar
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3 text-sm text-slate-700">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 leading-relaxed ${
                  message.from === "bot"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-white text-slate-800 shadow-sm"
                }`}
              >
                {message.text.split("\n").map((line, index) => (
                  <p key={`${message.id}-${index}`}>{line}</p>
                ))}
              </div>
            ))}
            {loading ? <p className="text-xs text-slate-400">Consultando...</p> : null}
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-emerald-100 bg-white/80 px-3 py-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex: Louvor, Casais, Intercessao..."
              className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-300 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canSend || loading}
              className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Enviar
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700"
      >
        Tirar duvidas
      </button>
    </div>
  );
}
