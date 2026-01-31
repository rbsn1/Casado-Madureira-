"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type UserRole = { role: string; active: boolean };
type UserItem = { id: string; email: string | null; created_at: string; roles: UserRole[] };
type WeeklyScheduleEvent = {
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
};

const roleOptions = [
  "ADMIN_MASTER",
  "PASTOR",
  "SECRETARIA",
  "NOVOS_CONVERTIDOS",
  "LIDER_DEPTO",
  "VOLUNTARIO"
];

const weekdayOptions = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" }
];

async function apiFetch(path: string, options: RequestInit = {}) {
  if (!supabaseClient) throw new Error("Supabase não configurado.");
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa.");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro na requisição.");
  return payload;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgStatus, setBgStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [bgMessage, setBgMessage] = useState("");
  const [agendaEvents, setAgendaEvents] = useState<WeeklyScheduleEvent[]>([]);
  const [agendaStatus, setAgendaStatus] = useState<"idle" | "loading" | "error">("loading");
  const [agendaMessage, setAgendaMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [agendaForm, setAgendaForm] = useState({
    title: "",
    weekday: 0,
    start_time: "",
    location: "",
    notes: "",
    is_active: true
  });
  const [editForm, setEditForm] = useState({
    title: "",
    weekday: 0,
    start_time: "",
    location: "",
    notes: "",
    is_active: true
  });

  async function loadUsers() {
    setLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch("/api/admin/users");
      setUsers(data.users ?? []);
      setRoleByUser((prev) => {
        const next = { ...prev };
        (data.users ?? []).forEach((user: UserItem) => {
          if (!next[user.id]) next[user.id] = roleOptions[0];
        });
        return next;
      });
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBackground() {
    try {
      const data = await apiFetch("/api/settings?key=login_background_url");
      setBgUrl(data.value ?? null);
    } catch {
      setBgUrl(null);
    }
  }

  async function loadAgendaEvents() {
    setAgendaStatus("loading");
    setAgendaMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data, error } = await supabaseClient
        .from("weekly_schedule_events")
        .select("*")
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      setAgendaEvents((data ?? []) as WeeklyScheduleEvent[]);
      setAgendaStatus("idle");
    } catch (error) {
      setAgendaStatus("error");
      setAgendaMessage((error as Error).message);
    }
  }

  useEffect(() => {
    loadUsers();
    loadBackground();
    loadAgendaEvents();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatusMessage("");
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "");
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
      });
      form.reset();
      await loadUsers();
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  }

  async function handleAddRole(userId: string) {
    setStatusMessage("");
    try {
      await apiFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({ userId, role: roleByUser[userId] ?? roleOptions[0] })
      });
      await loadUsers();
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  }

  async function handleUploadBackground(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBgStatus("loading");
    setBgMessage("");
    const formData = new FormData(form);
    const file = formData.get("background");
    const hasFile = file && typeof file === "object" && "name" in file && "size" in file;
    if (!hasFile || (file as File).size === 0) {
      setBgStatus("error");
      setBgMessage("Selecione uma imagem.");
      return;
    }
    if (!(file as File).type.startsWith("image/")) {
      setBgStatus("error");
      setBgMessage("Envie um arquivo de imagem válido.");
      return;
    }
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sem sessão ativa.");
      const response = await fetch("/api/admin/login-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao enviar imagem.");
      setBgUrl(payload.url ?? null);
      setBgStatus("success");
      setBgMessage("Imagem atualizada com sucesso.");
      form.reset();
    } catch (error) {
      setBgStatus("error");
      setBgMessage((error as Error).message);
    }
  }

  async function handleCreateAgendaEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAgendaMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const payload = {
        title: agendaForm.title.trim(),
        weekday: Number(agendaForm.weekday),
        start_time: agendaForm.start_time,
        location: agendaForm.location?.trim() || null,
        notes: agendaForm.notes?.trim() || null,
        is_active: agendaForm.is_active
      };
      const { error } = await supabaseClient.from("weekly_schedule_events").insert(payload);
      if (error) throw error;
      setAgendaForm({
        title: "",
        weekday: 0,
        start_time: "",
        location: "",
        notes: "",
        is_active: true
      });
      await loadAgendaEvents();
    } catch (error) {
      setAgendaMessage((error as Error).message);
    }
  }

  function startEdit(event: WeeklyScheduleEvent) {
    setEditingId(event.id);
    setEditForm({
      title: event.title,
      weekday: event.weekday,
      start_time: event.start_time,
      location: event.location ?? "",
      notes: event.notes ?? "",
      is_active: event.is_active
    });
  }

  async function handleUpdateAgendaEvent(eventId: string) {
    setAgendaMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const payload = {
        title: editForm.title.trim(),
        weekday: Number(editForm.weekday),
        start_time: editForm.start_time,
        location: editForm.location?.trim() || null,
        notes: editForm.notes?.trim() || null,
        is_active: editForm.is_active
      };
      const { error } = await supabaseClient
        .from("weekly_schedule_events")
        .update(payload)
        .eq("id", eventId);
      if (error) throw error;
      setEditingId(null);
      await loadAgendaEvents();
    } catch (error) {
      setAgendaMessage((error as Error).message);
    }
  }

  async function handleDeleteAgendaEvent(eventId: string) {
    setAgendaMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { error } = await supabaseClient.from("weekly_schedule_events").delete().eq("id", eventId);
      if (error) throw error;
      await loadAgendaEvents();
    } catch (error) {
      setAgendaMessage((error as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Administração</p>
        <h2 className="text-xl font-semibold text-emerald-900">Usuários e Permissões</h2>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-3" onSubmit={handleCreateUser}>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">E-mail</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Senha inicial</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Role</span>
          <select
            name="role"
            defaultValue={roleOptions[0]}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-3">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Criar usuário
          </button>
        </div>
      </form>

      <form className="card space-y-3 p-4" onSubmit={handleUploadBackground}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Papel de parede do login</p>
            <p className="text-xs text-slate-500">Recomendado: imagem horizontal em alta resolução.</p>
          </div>
          {bgUrl ? (
            <a
              href={bgUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-900"
            >
              Ver imagem atual
            </a>
          ) : null}
        </div>
        <input
          name="background"
          type="file"
          accept="image/*"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          disabled={bgStatus === "loading"}
        >
          {bgStatus === "loading" ? "Enviando..." : "Atualizar imagem"}
        </button>
        {bgStatus === "error" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {bgMessage || "Não foi possível atualizar a imagem."}
          </p>
        ) : null}
        {bgStatus === "success" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {bgMessage}
          </p>
        ) : null}
      </form>

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Agenda semanal</p>
            <p className="text-xs text-slate-500">Gerencie os eventos que aparecem no portal.</p>
          </div>
          <button
            type="button"
            onClick={loadAgendaEvents}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Atualizar agenda
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleCreateAgendaEvent}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Título</span>
            <input
              name="title"
              required
              value={agendaForm.title}
              onChange={(event) => setAgendaForm((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Dia da semana</span>
            <select
              name="weekday"
              value={agendaForm.weekday}
              onChange={(event) =>
                setAgendaForm((prev) => ({ ...prev, weekday: Number(event.target.value) }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              {weekdayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Horário</span>
            <input
              name="start_time"
              type="time"
              required
              value={agendaForm.start_time}
              onChange={(event) => setAgendaForm((prev) => ({ ...prev, start_time: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Local</span>
            <input
              name="location"
              value={agendaForm.location}
              onChange={(event) => setAgendaForm((prev) => ({ ...prev, location: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-700">Observações</span>
            <input
              name="notes"
              value={agendaForm.notes}
              onChange={(event) => setAgendaForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agendaForm.is_active}
              onChange={(event) => setAgendaForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ativo
          </label>
          <div className="md:col-span-2 lg:col-span-3">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Adicionar evento
            </button>
          </div>
        </form>

        {agendaMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {agendaMessage}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Evento", "Dia/Horário", "Local", "Observações", "Status", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agendaStatus === "loading" ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando agenda...
                  </td>
                </tr>
              ) : null}
              {agendaStatus !== "loading" && !agendaEvents.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum evento cadastrado.
                  </td>
                </tr>
              ) : null}
              {agendaEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {editingId === event.id ? (
                      <input
                        value={editForm.title}
                        onChange={(ev) => setEditForm((prev) => ({ ...prev, title: ev.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                      />
                    ) : (
                      event.title
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {editingId === event.id ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={editForm.weekday}
                          onChange={(ev) =>
                            setEditForm((prev) => ({ ...prev, weekday: Number(ev.target.value) }))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                        >
                          {weekdayOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={editForm.start_time}
                          onChange={(ev) => setEditForm((prev) => ({ ...prev, start_time: ev.target.value }))}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    ) : (
                      `${weekdayOptions.find((option) => option.value === event.weekday)?.label ?? "Dia"} • ${event.start_time.slice(0, 5)}`
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {editingId === event.id ? (
                      <input
                        value={editForm.location}
                        onChange={(ev) => setEditForm((prev) => ({ ...prev, location: ev.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                      />
                    ) : (
                      event.location || "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {editingId === event.id ? (
                      <input
                        value={editForm.notes}
                        onChange={(ev) => setEditForm((prev) => ({ ...prev, notes: ev.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                      />
                    ) : (
                      event.notes || "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {editingId === event.id ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(ev) => setEditForm((prev) => ({ ...prev, is_active: ev.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {editForm.is_active ? "Ativo" : "Inativo"}
                      </label>
                    ) : event.is_active ? (
                      "Ativo"
                    ) : (
                      "Inativo"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {editingId === event.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateAgendaEvent(event.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(event)}
                            className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgendaEvent(event.id)}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-emerald-900">Usuários cadastrados</h3>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Atualizar
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["E-mail", "Criado em", "Roles", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando usuários...
                  </td>
                </tr>
              ) : null}
              {!loading && !users.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : null}
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-slate-700">{user.email ?? "Sem e-mail"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {user.roles.length
                      ? user.roles.map((role) => `${role.role}${role.active ? "" : " (inativo)"}`).join(", ")
                      : "Sem roles"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={roleByUser[user.id] ?? roleOptions[0]}
                        onChange={(event) =>
                          setRoleByUser((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddRole(user.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Atribuir role
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
