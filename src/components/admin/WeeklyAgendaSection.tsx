"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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

const weekdayOptions = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" }
];

const emptyForm = {
  title: "",
  weekday: 0,
  start_time: "",
  location: "",
  notes: "",
  is_active: true
};

export function WeeklyAgendaSection() {
  const [agendaEvents, setAgendaEvents] = useState<WeeklyScheduleEvent[]>([]);
  const [agendaStatus, setAgendaStatus] = useState<"idle" | "loading" | "error">("loading");
  const [agendaMessage, setAgendaMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [agendaForm, setAgendaForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

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
    loadAgendaEvents();
  }, []);

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
      setAgendaForm(emptyForm);
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
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-900">Agenda semanal</p>
          <p className="text-xs text-text-muted">Gerencie os eventos que aparecem no portal.</p>
        </div>
        <button
          type="button"
          onClick={loadAgendaEvents}
          className="rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-50"
        >
          Atualizar agenda
        </button>
      </div>

      <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleCreateAgendaEvent}>
        <label className="space-y-1 text-sm">
          <span className="text-text">Título</span>
          <input
            name="title"
            required
            value={agendaForm.title}
            onChange={(event) => setAgendaForm((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Dia da semana</span>
          <select
            name="weekday"
            value={agendaForm.weekday}
            onChange={(event) =>
              setAgendaForm((prev) => ({ ...prev, weekday: Number(event.target.value) }))
            }
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {weekdayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Horário</span>
          <input
            name="start_time"
            type="time"
            required
            value={agendaForm.start_time}
            onChange={(event) => setAgendaForm((prev) => ({ ...prev, start_time: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Local</span>
          <input
            name="location"
            value={agendaForm.location}
            onChange={(event) => setAgendaForm((prev) => ({ ...prev, location: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-text">Observações</span>
          <input
            name="notes"
            value={agendaForm.notes}
            onChange={(event) => setAgendaForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={agendaForm.is_active}
            onChange={(event) => setAgendaForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            className="h-4 w-4 rounded border-border"
          />
          Ativo
        </label>
        <div className="md:col-span-2 lg:col-span-3">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Adicionar evento
          </button>
        </div>
      </form>

      {agendaMessage ? (
        <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
          {agendaMessage}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface">
            <tr>
              {["Evento", "Dia/Horário", "Local", "Observações", "Status", "Ações"].map((col) => (
                <th key={col} className="px-4 py-2 text-left font-semibold text-text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {agendaStatus === "loading" ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                  Carregando agenda...
                </td>
              </tr>
            ) : null}
            {agendaStatus !== "loading" && !agendaEvents.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                  Nenhum evento cadastrado.
                </td>
              </tr>
            ) : null}
            {agendaEvents.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 text-text">
                  {editingId === event.id ? (
                    <input
                      value={editForm.title}
                      onChange={(ev) => setEditForm((prev) => ({ ...prev, title: ev.target.value }))}
                      className="w-full rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
                    />
                  ) : (
                    event.title
                  )}
                </td>
                <td className="px-4 py-3 text-text">
                  {editingId === event.id ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={editForm.weekday}
                        onChange={(ev) =>
                          setEditForm((prev) => ({ ...prev, weekday: Number(ev.target.value) }))
                        }
                        className="rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
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
                        className="rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
                      />
                    </div>
                  ) : (
                    `${weekdayOptions.find((option) => option.value === event.weekday)?.label ?? "Dia"} • ${event.start_time.slice(0, 5)}`
                  )}
                </td>
                <td className="px-4 py-3 text-text">
                  {editingId === event.id ? (
                    <input
                      value={editForm.location}
                      onChange={(ev) => setEditForm((prev) => ({ ...prev, location: ev.target.value }))}
                      className="w-full rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
                    />
                  ) : (
                    event.location || "-"
                  )}
                </td>
                <td className="px-4 py-3 text-text">
                  {editingId === event.id ? (
                    <input
                      value={editForm.notes}
                      onChange={(ev) => setEditForm((prev) => ({ ...prev, notes: ev.target.value }))}
                      className="w-full rounded-lg border border-border px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
                    />
                  ) : (
                    event.notes || "-"
                  )}
                </td>
                <td className="px-4 py-3 text-text">
                  {editingId === event.id ? (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={editForm.is_active}
                        onChange={(ev) => setEditForm((prev) => ({ ...prev, is_active: ev.target.checked }))}
                        className="h-4 w-4 rounded border-border"
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
                          className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-muted hover:bg-surface"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(event)}
                          className="rounded-lg border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-900 hover:bg-brand-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAgendaEvent(event.id)}
                          className="rounded-lg border border-danger-100 px-3 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-100"
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
  );
}
