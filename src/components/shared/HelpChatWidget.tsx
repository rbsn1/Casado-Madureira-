"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PublicDept = {
  id: string;
  name: string;
  slug: string;
  type: string;
  parent_id: string | null;
  is_active: boolean;
};

type PublicContact = {
  department_id: string;
  display_name: string;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
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
    text: "Oi! Antes de começarmos, qual é o seu nome?"
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
  const candidates = departments.filter((dept) => dept.is_active);
  const direct = candidates.find((dept) => normalizeText(dept.name).includes(normalized));
  if (direct) return direct;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return candidates.find((dept) => words.some((word) => normalizeText(dept.name).includes(word))) ?? null;
}

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [departments, setDepartments] = useState<PublicDept[]>([]);
  const [contacts, setContacts] = useState<PublicContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("departments")
        .select("id, name, slug, type, parent_id, is_active")
        .eq("is_active", true)
        .order("name");
      if (!active) return;
      if (error) return;
      setDepartments((data ?? []) as PublicDept[]);
    }

    async function loadContacts() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("department_contacts")
        .select("department_id, display_name, whatsapp, phone, email, is_active")
        .eq("is_active", true);
      if (!active) return;
      if (error) return;
      setContacts((data ?? []) as PublicContact[]);
    }

    if (open) {
      loadDepartments();
      loadContacts();
    }

    if (!open) {
      setMessages(initialMessages);
      setInput("");
      setLoading(false);
      setTyping(false);
      setVisitorName(null);
    }

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, open]);

  const canSend = useMemo(() => input.trim().length > 1, [input]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const value = input.trim();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id, from: "user", text: value }]);
    setInput("");
    setLoading(true);
    setTyping(true);

    if (!visitorName) {
      setVisitorName(value);
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-bot`,
          from: "bot",
          text: `Prazer, ${value}! Agora me diga o nome do departamento e eu informo quem procurar.`
        }
      ]);
      setLoading(false);
      setTyping(false);
      return;
    }

    const match = matchDepartment(departments, value);
    if (match) {
      const deptContacts = contacts.filter((item) => item.department_id === match.id);
      const contactLines = deptContacts.length
        ? deptContacts
            .slice(0, 2)
            .map((item) => {
              const channel = item.whatsapp ?? item.phone ?? item.email ?? "Contato indisponível";
              return `• ${item.display_name}: ${channel}`;
            })
            .join("\n")
        : "• Contato: secretaria do CCM.";
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-bot`,
          from: "bot",
          text: `Entendi. Para o departamento ${match.name}, procure:\n${contactLines}\nSe precisar de outro setor, pode me falar.`
        }
      ]);
      setLoading(false);
      setTyping(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${id}-bot`,
        from: "bot",
        text: "Não encontrei esse departamento. Pode me dizer o nome completo? Se preferir, fale com a secretaria para direcionamento."
      }
    ]);
    setLoading(false);
    setTyping(false);
  }

  return (
    <div className="fixed bottom-5 left-4 right-4 z-50 flex flex-col items-stretch gap-2 sm:left-auto sm:right-5 sm:items-end">
      {open ? (
        <div className="w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white/90 shadow-2xl shadow-black/10 backdrop-blur-lg sm:w-[320px]">
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
          <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3 text-sm text-slate-700 sm:max-h-72">
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
            {typing ? <p className="text-xs text-slate-400">Digitando...</p> : null}
            <div ref={endRef} />
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-emerald-100 bg-white/80 px-3 py-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex: Louvor, Casais, Intercessão..."
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
          <div className="border-t border-emerald-100 px-4 py-2 text-[11px] text-slate-500">
            Este chat informa apenas sobre departamentos e contatos.
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 sm:w-auto"
      >
        Tirar dúvidas
      </button>
    </div>
  );
}
