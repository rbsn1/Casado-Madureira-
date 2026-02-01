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

type PublicRole = {
  id: string;
  department_id: string;
  role_name: string;
  role_key: string;
  role_priority: number;
  is_public: boolean;
  is_active: boolean;
};

type PublicContact = {
  department_id: string;
  role_id: string | null;
  display_name: string;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type PublicFaq = {
  department_id: string;
  intent: "about" | "contact" | "schedule" | "participate" | "location";
  answer_title: string;
  answer_body: string;
  is_active: boolean;
  created_at: string;
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
  const [roles, setRoles] = useState<PublicRole[]>([]);
  const [contacts, setContacts] = useState<PublicContact[]>([]);
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [pendingDept, setPendingDept] = useState<PublicDept | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PublicFaq["intent"] | null>(null);
  const [lastInteractionAt, setLastInteractionAt] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("departamentos")
        .select("id, nome, type, parent_id, ativo")
        .eq("ativo", true)
        .order("nome");
      if (!active) return;
      if (error) return;
      const mapped = (data ?? []).map((item) => ({
        id: item.id,
        name: item.nome,
        slug: item.nome,
        type: item.type ?? "simple",
        parent_id: item.parent_id ?? null,
        is_active: item.ativo ?? true
      })) as PublicDept[];
      setDepartments(mapped);
    }

    async function loadContacts() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("department_contacts")
        .select("department_id, role_id, display_name, whatsapp, phone, email, is_active")
        .eq("is_active", true);
      if (!active) return;
      if (error) return;
      setContacts((data ?? []) as PublicContact[]);
    }

    async function loadRoles() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("department_roles")
        .select("id, department_id, role_name, role_key, role_priority, is_public, is_active")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("role_priority", { ascending: true });
      if (!active) return;
      if (error) return;
      setRoles((data ?? []) as PublicRole[]);
    }

    async function loadFaqs() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("department_faq")
        .select("department_id, intent, answer_title, answer_body, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) return;
      setFaqs((data ?? []) as PublicFaq[]);
    }

    if (open) {
      setLastInteractionAt(Date.now());
      loadDepartments();
      loadContacts();
      loadRoles();
      loadFaqs();
    }

    if (!open) {
      setMessages(initialMessages);
      setInput("");
      setLoading(false);
      setTyping(false);
      setVisitorName(null);
      setChips([]);
      setPendingDept(null);
      setPendingIntent(null);
      setLastInteractionAt(null);
    }

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !lastInteractionAt) return;
    const timeoutId = setTimeout(() => {
      setMessages(initialMessages);
      setInput("");
      setLoading(false);
      setTyping(false);
      setVisitorName(null);
      setChips([]);
      setPendingDept(null);
      setPendingIntent(null);
      setLastInteractionAt(Date.now());
    }, 60000);

    return () => clearTimeout(timeoutId);
  }, [open, lastInteractionAt]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (!open || !visitorName || pendingDept || chips.length) return;
    if (!departments.length) return;
    setChips(getDepartmentChips());
  }, [open, visitorName, pendingDept, chips.length, departments.length]);

  const canSend = useMemo(() => input.trim().length > 1, [input]);

  function pushBotMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from: "bot", text }
    ]);
  }

  function getIntentChips() {
    return ["Contato", "Participar"];
  }

  function getEligibleDepartments() {
    return departments.filter((dept) => dept.is_active);
  }

  function getDepartmentChips() {
    return getEligibleDepartments().map((dept) => dept.name);
  }

  function mapIntent(label: string): PublicFaq["intent"] | null {
    const normalized = normalizeText(label);
    if (normalized.includes("contato")) return "contact";
    if (normalized.includes("participar")) return "contact";
    return null;
  }

  function getFaqAnswer(deptId: string, intent: PublicFaq["intent"]) {
    const list = faqs.filter((item) => item.department_id === deptId && item.intent === intent);
    return list[0] ?? null;
  }

  function replyWithContacts(deptId: string, roleId?: string | null) {
    const deptContacts = contacts.filter(
      (item) => item.department_id === deptId && (!roleId || item.role_id === roleId)
    );
    const contactLines = deptContacts.length
      ? deptContacts
          .slice(0, 3)
          .map((item) => {
            const channel = item.whatsapp ?? item.phone ?? item.email ?? "Contato indisponível";
            return `• ${item.display_name}: ${channel}`;
          })
          .join("\n")
      : "No momento estamos sem o contato do líder do departamento, mas logo será adicionado.";
    pushBotMessage(`Aqui estão os contatos:\n${contactLines}`);
  }

  async function processMessage(rawValue: string) {
    const value = rawValue.trim();
    if (value.length < 2) return;
    setLastInteractionAt(Date.now());
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
          text: `Prazer, ${value}! Qual área você procura?`
        }
      ]);
      const departmentChips = getDepartmentChips();
      if (departmentChips.length) {
        setChips(departmentChips);
      } else {
        pushBotMessage("Carregando as áreas disponíveis...");
      }
      setLoading(false);
      setTyping(false);
      return;
    }

    if (pendingDept && (pendingDept.type === "umbrella" || pendingDept.type === "mixed")) {
      const subs = departments.filter((dept) => dept.parent_id === pendingDept.id);
      const normalizedValue = normalizeText(value);
      if (normalizedValue.includes("coordenacao") || normalizedValue.includes("coordenação")) {
        setChips(getIntentChips());
        pushBotMessage(`Perfeito. Sobre ${pendingDept.name}, o que você deseja saber?`);
        setLoading(false);
        setTyping(false);
        return;
      }
      const matchedSub = subs.find((item) =>
        normalizeText(item.name).includes(normalizeText(value))
      );
      if (matchedSub) {
        setPendingDept(matchedSub);
        setChips(getIntentChips());
        pushBotMessage(`Certo! Sobre ${matchedSub.name}, o que você deseja saber?`);
        setLoading(false);
        setTyping(false);
        return;
      }
      pushBotMessage("Você deseja falar com a coordenação geral ou com um subdepartamento?");
      setChips(["Coordenação geral", ...subs.map((item) => item.name)]);
      setLoading(false);
      setTyping(false);
      return;
    }

    if (pendingDept && pendingDept.type === "colegiado" && pendingIntent === "contact") {
      const deptRoles = roles.filter((item) => item.department_id === pendingDept.id);
      const matchedRole = deptRoles.find((item) =>
        normalizeText(item.role_name).includes(normalizeText(value))
      );
      if (matchedRole) {
        replyWithContacts(pendingDept.id, matchedRole.id);
        setPendingIntent(null);
        setChips(getIntentChips());
        setLoading(false);
        setTyping(false);
        return;
      }
      pushBotMessage("Qual liderança você procura?");
      setChips(deptRoles.map((item) => item.role_name));
      setLoading(false);
      setTyping(false);
      return;
    }

    if (pendingDept) {
      const mappedIntent = mapIntent(value);
      if (mappedIntent) {
        if (mappedIntent === "contact" && pendingDept.type === "colegiado") {
          const deptRoles = roles.filter((item) => item.department_id === pendingDept.id);
          if (deptRoles.length) {
            setPendingIntent("contact");
            setChips(deptRoles.map((item) => item.role_name));
            pushBotMessage("Qual liderança você procura?");
            setLoading(false);
            setTyping(false);
            return;
          }
        }

        const answer = getFaqAnswer(pendingDept.id, mappedIntent);
        if (answer) {
          pushBotMessage(`${answer.answer_title}\n${answer.answer_body}`);
        } else {
          pushBotMessage("Ainda não tenho uma resposta pronta para isso. Posso ajudar com contatos.");
        }
        if (mappedIntent === "contact") {
          replyWithContacts(pendingDept.id);
        }
        setPendingIntent(null);
        setChips(getIntentChips());
        setLoading(false);
        setTyping(false);
        return;
      }

      pushBotMessage("Posso ajudar com: Contato ou Participar.");
      setChips(getIntentChips());
      setLoading(false);
      setTyping(false);
      return;
    }

    const match = matchDepartment(getEligibleDepartments(), value);
    if (match) {
      setPendingDept(match);
      if (match.type === "umbrella" || match.type === "mixed") {
        const subs = departments.filter((dept) => dept.parent_id === match.id);
        setChips(["Coordenação geral", ...subs.map((item) => item.name)]);
        pushBotMessage("Você deseja falar com a coordenação geral ou com um subdepartamento?");
      } else {
        setChips(getIntentChips());
        pushBotMessage(`Entendi. ${match.name}: deseja Contato ou Participar?`);
      }
      setLoading(false);
      setTyping(false);
      return;
    }

    pushBotMessage(
      "Não encontrei esse departamento. Pode me dizer o nome completo? Se preferir, fale com a secretaria para direcionamento."
    );
    setLoading(false);
    setTyping(false);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    await processMessage(input);
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
            {chips.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      processMessage(chip);
                    }}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-emerald-100 bg-white/80 px-3 py-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex: Louvor, Casais, Intercessão..."
              className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-base sm:text-xs focus:border-emerald-300 focus:outline-none"
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
