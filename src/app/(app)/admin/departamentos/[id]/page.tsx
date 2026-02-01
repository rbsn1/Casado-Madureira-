"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabaseClient } from "@/lib/supabaseClient";
import { slugify } from "@/lib/slugify";

type Department = {
  id: string;
  name: string;
  slug: string;
  type: "simple" | "colegiado" | "umbrella" | "mixed";
  parent_id: string | null;
  short_description: string | null;
  long_description: string | null;
  location: string | null;
  meeting_info: string | null;
  is_active: boolean;
  sort_order: number;
};

type DepartmentRole = {
  id: string;
  role_name: string;
  role_key: string;
  role_priority: number;
  is_public: boolean;
  is_active: boolean;
};

type DepartmentContact = {
  id: string;
  role_id: string | null;
  display_name: string;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  availability: string | null;
  notes: string | null;
  is_active: boolean;
};

type DepartmentFaq = {
  id: string;
  intent: "about" | "contact" | "schedule" | "participate" | "location";
  answer_title: string;
  answer_body: string;
  is_active: boolean;
};

const typeLabels: Record<Department["type"], string> = {
  simple: "Simples",
  colegiado: "Colegiado",
  umbrella: "Guarda-chuva",
  mixed: "Misto"
};

const intentLabels: Record<DepartmentFaq["intent"], string> = {
  about: "Sobre",
  contact: "Contato",
  schedule: "Agenda",
  participate: "Participar",
  location: "Local"
};

export default function AdminDepartamentoDetalhePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [parents, setParents] = useState<Department[]>([]);
  const [roles, setRoles] = useState<DepartmentRole[]>([]);
  const [contacts, setContacts] = useState<DepartmentContact[]>([]);
  const [faqs, setFaqs] = useState<DepartmentFaq[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("dados");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingRole, setEditingRole] = useState<DepartmentRole | null>(null);
  const [editingContact, setEditingContact] = useState<DepartmentContact | null>(null);
  const [editingFaq, setEditingFaq] = useState<DepartmentFaq | null>(null);

  const departmentId = String(params.id);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  async function loadAll() {
    setStatus("loading");
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const [deptResult, parentsResult, roleResult, contactResult, faqResult] = await Promise.all([
        supabaseClient.from("departments").select("*").eq("id", departmentId).maybeSingle(),
        supabaseClient.from("departments").select("id, name").order("name"),
        supabaseClient.from("department_roles").select("*").eq("department_id", departmentId).order("role_priority"),
        supabaseClient.from("department_contacts").select("*").eq("department_id", departmentId).order("display_name"),
        supabaseClient.from("department_faq").select("*").eq("department_id", departmentId).order("created_at", { ascending: false })
      ]);

      if (deptResult.error) throw deptResult.error;
      if (parentsResult.error) throw parentsResult.error;
      if (roleResult.error) throw roleResult.error;
      if (contactResult.error) throw contactResult.error;
      if (faqResult.error) throw faqResult.error;

      setDepartment((deptResult.data ?? null) as Department | null);
      setParents((parentsResult.data ?? []) as Department[]);
      setRoles((roleResult.data ?? []) as DepartmentRole[]);
      setContacts((contactResult.data ?? []) as DepartmentContact[]);
      setFaqs((faqResult.data ?? []) as DepartmentFaq[]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    if (role === "admin") loadAll();
  }, [role]);

  async function handleSaveDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !department) return;
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      type: String(formData.get("type") ?? "simple"),
      parent_id: String(formData.get("parent_id") ?? "") || null,
      short_description: String(formData.get("short_description") ?? "") || null,
      long_description: String(formData.get("long_description") ?? "") || null,
      location: String(formData.get("location") ?? "") || null,
      meeting_info: String(formData.get("meeting_info") ?? "") || null,
      is_active: formData.get("is_active") === "on",
      sort_order: Number(formData.get("sort_order") ?? 0)
    };
    const { error } = await supabaseClient.from("departments").update(payload).eq("id", department.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadAll();
  }

  async function handleSaveRole() {
    if (!supabaseClient) return;
    const form = document.getElementById("role-form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    const roleName = String(data.get("role_name") ?? "");
    const payload = {
      department_id: departmentId,
      role_name: roleName,
      role_key: String(data.get("role_key") ?? slugify(roleName)),
      role_priority: Number(data.get("role_priority") ?? 0),
      is_public: data.get("is_public") === "on",
      is_active: data.get("is_active") === "on"
    };
    const query = editingRole
      ? supabaseClient.from("department_roles").update(payload).eq("id", editingRole.id)
      : supabaseClient.from("department_roles").insert(payload);
    const { error } = await query;
    if (error) {
      setMessage(error.message);
      return;
    }
    setShowRoleModal(false);
    setEditingRole(null);
    await loadAll();
  }

  async function handleSaveContact() {
    if (!supabaseClient) return;
    const form = document.getElementById("contact-form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    const payload = {
      department_id: departmentId,
      role_id: String(data.get("role_id") ?? "") || null,
      display_name: String(data.get("display_name") ?? ""),
      whatsapp: String(data.get("whatsapp") ?? "") || null,
      phone: String(data.get("phone") ?? "") || null,
      email: String(data.get("email") ?? "") || null,
      availability: String(data.get("availability") ?? "") || null,
      notes: String(data.get("notes") ?? "") || null,
      is_active: data.get("is_active") === "on"
    };
    if (!payload.whatsapp && !payload.phone && !payload.email) {
      setMessage("Informe ao menos um meio de contato.");
      return;
    }
    const query = editingContact
      ? supabaseClient.from("department_contacts").update(payload).eq("id", editingContact.id)
      : supabaseClient.from("department_contacts").insert(payload);
    const { error } = await query;
    if (error) {
      setMessage(error.message);
      return;
    }
    setShowContactModal(false);
    setEditingContact(null);
    await loadAll();
  }

  async function handleSaveFaq() {
    if (!supabaseClient) return;
    const form = document.getElementById("faq-form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    const payload = {
      department_id: departmentId,
      intent: String(data.get("intent") ?? "about"),
      answer_title: String(data.get("answer_title") ?? ""),
      answer_body: String(data.get("answer_body") ?? ""),
      is_active: data.get("is_active") === "on"
    };
    const query = editingFaq
      ? supabaseClient.from("department_faq").update(payload).eq("id", editingFaq.id)
      : supabaseClient.from("department_faq").insert(payload);
    const { error } = await query;
    if (error) {
      setMessage(error.message);
      return;
    }
    setShowFaqModal(false);
    setEditingFaq(null);
    await loadAll();
  }

  if (loading) {
    return <div className="card p-6 text-sm text-slate-600">Carregando permissões...</div>;
  }

  if (!user || role !== "admin") {
    return <div className="card p-6 text-sm text-slate-600">Sem permissão.</div>;
  }

  if (status === "loading" || !department) {
    return <div className="card p-6 text-sm text-slate-600">Carregando departamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Administração</p>
          <h2 className="text-xl font-semibold text-emerald-900">{department.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              {typeLabels[department.type]}
            </span>
            <span>{department.is_active ? "Ativo" : "Inativo"}</span>
          </div>
        </div>
        <Link
          href={`/app/departamentos/${department.slug}`}
          className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
        >
          Visualizar no acesso interno
        </Link>
      </div>

      {message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { key: "dados", label: "Dados do departamento" },
          { key: "roles", label: "Lideranças" },
          { key: "contatos", label: "Contatos" },
          { key: "faq", label: "Respostas do chat" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === tab.key
                ? "bg-emerald-600 text-white"
                : "border border-emerald-200 text-emerald-900 hover:bg-emerald-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dados" ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={handleSaveDepartment}>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Nome</span>
            <input
              name="name"
              defaultValue={department.name}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Slug</span>
            <input
              name="slug"
              defaultValue={department.slug}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Tipo</span>
            <select
              name="type"
              defaultValue={department.type}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Departamento pai</span>
            <select
              name="parent_id"
              defaultValue={department.parent_id ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Nenhum</option>
              {parents.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Descrição curta</span>
            <input
              name="short_description"
              defaultValue={department.short_description ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Descrição longa</span>
            <textarea
              name="long_description"
              defaultValue={department.long_description ?? ""}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Local</span>
            <input
              name="location"
              defaultValue={department.location ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Informações de reunião</span>
            <input
              name="meeting_info"
              defaultValue={department.meeting_info ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Ordem</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={department.sort_order}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={department.is_active}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ativo
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Salvar
            </button>
          </div>
        </form>
      ) : null}

      {activeTab === "roles" ? (
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Lideranças</h3>
            <button
              type="button"
              onClick={() => {
                setEditingRole(null);
                setShowRoleModal(true);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Nova liderança
            </button>
          </div>
          <div className="space-y-2">
            {roles.length ? (
              roles.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.role_name}</p>
                    <p className="text-xs text-slate-500">Chave: {item.role_key}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRole(item);
                      setShowRoleModal(true);
                    }}
                    className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nenhuma liderança cadastrada.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "contatos" ? (
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Contatos</h3>
            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setShowContactModal(true);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Novo contato
            </button>
          </div>
          <div className="space-y-2">
            {contacts.length ? (
              contacts.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.display_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.whatsapp ?? item.phone ?? item.email ?? "Contato não informado"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContact(item);
                      setShowContactModal(true);
                    }}
                    className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nenhum contato cadastrado.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "faq" ? (
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Respostas do chat</h3>
            <button
              type="button"
              onClick={() => {
                setEditingFaq(null);
                setShowFaqModal(true);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Nova resposta
            </button>
          </div>
          <div className="space-y-2">
            {faqs.length ? (
              faqs.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.answer_title}</p>
                    <p className="text-xs text-slate-500">Intent: {intentLabels[item.intent]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFaq(item);
                      setShowFaqModal(true);
                    }}
                    className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nenhuma resposta cadastrada.</p>
            )}
          </div>
        </div>
      ) : null}

      {showRoleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">
                {editingRole ? "Editar liderança" : "Nova liderança"}
              </h3>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <form id="role-form" className="mt-4 grid gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Nome da liderança</span>
                <input
                  name="role_name"
                  defaultValue={editingRole?.role_name ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Chave</span>
                <input
                  name="role_key"
                  defaultValue={editingRole?.role_key ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Prioridade</span>
                <input
                  name="role_priority"
                  type="number"
                  defaultValue={editingRole?.role_priority ?? 0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_public"
                  type="checkbox"
                  defaultChecked={editingRole?.is_public ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Público
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editingRole?.is_active ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ativo
              </label>
            </form>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showContactModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">
                {editingContact ? "Editar contato" : "Novo contato"}
              </h3>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <form id="contact-form" className="mt-4 grid gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Nome de exibição</span>
                <input
                  name="display_name"
                  defaultValue={editingContact?.display_name ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Vincular a liderança</span>
                <select
                  name="role_id"
                  defaultValue={editingContact?.role_id ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Nenhuma</option>
                  {roles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.role_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">WhatsApp</span>
                <input
                  name="whatsapp"
                  defaultValue={editingContact?.whatsapp ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Telefone</span>
                <input
                  name="phone"
                  defaultValue={editingContact?.phone ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">E-mail</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingContact?.email ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Disponibilidade</span>
                <input
                  name="availability"
                  defaultValue={editingContact?.availability ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Observações</span>
                <input
                  name="notes"
                  defaultValue={editingContact?.notes ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editingContact?.is_active ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ativo
              </label>
            </form>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFaqModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">
                {editingFaq ? "Editar resposta" : "Nova resposta"}
              </h3>
              <button
                type="button"
                onClick={() => setShowFaqModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <form id="faq-form" className="mt-4 grid gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Intent</span>
                <select
                  name="intent"
                  defaultValue={editingFaq?.intent ?? "about"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {Object.entries(intentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Título</span>
                <input
                  name="answer_title"
                  defaultValue={editingFaq?.answer_title ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Resposta</span>
                <textarea
                  name="answer_body"
                  defaultValue={editingFaq?.answer_body ?? ""}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editingFaq?.is_active ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ativo
              </label>
            </form>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFaqModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFaq}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
