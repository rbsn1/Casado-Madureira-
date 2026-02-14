"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

type WeeklyEvent = {
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
};

const weekdayOptions = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" }
];

export default function AdminAgendaSemanalPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [events, setEvents] = useState<WeeklyEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [weekdayFilter, setWeekdayFilter] = useState<number | "todos">("todos");
  const [form, setForm] = useState({
    title: "",
    weekday: 0,
    start_time: "",
    location: "",
    notes: "",
    is_active: true
  });

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/acesso-interno");
    }
  }, [loading, user, router]);

  async function loadEvents() {
    setStatus("loading");
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data, error } = await supabaseClient
        .from("weekly_schedule_events")
        .select("*")
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      setEvents((data ?? []) as WeeklyEvent[]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [isAdmin]);

  function openCreate() {
    setEditingId(null);
    setForm({
      title: "",
      weekday: 0,
      start_time: "",
      location: "",
      notes: "",
      is_active: true
    });
    setShowForm(true);
  }

  function openEdit(event: WeeklyEvent) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      weekday: event.weekday,
      start_time: event.start_time,
      location: event.location ?? "",
      notes: event.notes ?? "",
      is_active: event.is_active
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const payload = {
        title: form.title.trim(),
        weekday: Number(form.weekday),
        start_time: form.start_time,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active
      };
      if (editingId) {
        const { error } = await supabaseClient
          .from("weekly_schedule_events")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("weekly_schedule_events").insert(payload);
        if (error) throw error;
      }
      setShowForm(false);
      await loadEvents();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function toggleActive(event: WeeklyEvent) {
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { error } = await supabaseClient
        .from("weekly_schedule_events")
        .update({ is_active: !event.is_active })
        .eq("id", event.id);
      if (error) throw error;
      await loadEvents();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function handleDelete(event: WeeklyEvent) {
    const confirmDelete = window.confirm(`Deseja remover o evento "${event.title}"?`);
    if (!confirmDelete) return;
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { error } = await supabaseClient
        .from("weekly_schedule_events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;
      await loadEvents();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  const modalTitle = useMemo(() => (editingId ? "Editar evento" : "Adicionar evento"), [editingId]);
  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const matchesTerm =
        !term ||
        event.title.toLowerCase().includes(term) ||
        (event.location ?? "").toLowerCase().includes(term) ||
        (event.notes ?? "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && event.is_active) ||
        (statusFilter === "inativos" && !event.is_active);
      const matchesWeekday = weekdayFilter === "todos" || event.weekday === weekdayFilter;

      return matchesTerm && matchesStatus && matchesWeekday;
    });
  }, [events, searchTerm, statusFilter, weekdayFilter]);

  if (loading) {
    return (
      <div className="card p-6 text-sm text-slate-600">Carregando permissões...</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Sem permissão para acessar esta página.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Administração</p>
          <h2 className="text-xl font-semibold text-emerald-900">Agenda semanal</h2>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Adicionar evento
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-emerald-900">Eventos cadastrados</h3>
          <button
            type="button"
            onClick={loadEvents}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Atualizar
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Buscar evento</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Título, local ou observação"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Dia da semana</span>
            <select
              value={weekdayFilter}
              onChange={(event) =>
                setWeekdayFilter(event.target.value === "todos" ? "todos" : Number(event.target.value))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="todos">Todos os dias</option>
              {weekdayOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "todos" | "ativos" | "inativos")}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Exibindo {filteredEvents.length} de {events.length} evento(s).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Dia", "Hora", "Título", "Local", "Observações", "Ativo", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {status === "loading" ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando agenda...
                  </td>
                </tr>
              ) : null}
              {status !== "loading" && !filteredEvents.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum evento encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {weekdayOptions.find((item) => item.value === event.weekday)?.label ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{event.start_time.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-slate-700">{event.title}</td>
                  <td className="px-4 py-3 text-slate-700">{event.location ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{event.notes ?? "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(event)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        event.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {event.is_active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(event)}
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-700">Título</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Dia da semana</span>
                <select
                  value={form.weekday}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, weekday: Number(event.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {weekdayOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Horário</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-700">Local</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-700">Observações</span>
                <input
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ativo
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
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
