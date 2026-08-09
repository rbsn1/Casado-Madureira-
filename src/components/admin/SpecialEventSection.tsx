"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatDateBR } from "@/lib/date";

type SpecialEventConfig = {
  is_active: boolean;
  title: string;
  subtitle: string;
  date: string;
  is_non_recurring: boolean;
  location: string;
  cta_label: string;
  cta_url: string;
  image_url: string;
  tag: string;
};

function toIsoDateFromBr(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const iso = `${yyyy}-${mm}-${dd}`;
  const test = new Date(iso);
  if (Number.isNaN(test.getTime())) return null;
  return iso;
}

export function SpecialEventSection() {
  const [specialStatus, setSpecialStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [specialMessage, setSpecialMessage] = useState("");
  const [specialEvent, setSpecialEvent] = useState<SpecialEventConfig>({
    is_active: false,
    title: "",
    subtitle: "",
    date: "",
    is_non_recurring: true,
    location: "",
    cta_label: "",
    cta_url: "",
    image_url: "",
    tag: ""
  });
  const [specialDateInput, setSpecialDateInput] = useState("");

  async function loadSpecialEvent() {
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data, error } = await supabaseClient
        .from("app_settings")
        .select("value")
        .eq("key", "special_event")
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        const parsed = JSON.parse(data.value) as SpecialEventConfig;
        setSpecialEvent({
          is_active: parsed.is_active ?? false,
          title: parsed.title ?? "",
          subtitle: parsed.subtitle ?? "",
          date: parsed.date ?? "",
          is_non_recurring: parsed.is_non_recurring ?? true,
          location: parsed.location ?? "",
          cta_label: parsed.cta_label ?? "",
          cta_url: parsed.cta_url ?? "",
          image_url: parsed.image_url ?? "",
          tag: parsed.tag ?? ""
        });
        setSpecialDateInput(parsed.date ? formatDateBR(parsed.date) : "");
      }
    } catch (error) {
      setSpecialMessage((error as Error).message);
      setSpecialStatus("error");
    }
  }

  useEffect(() => {
    loadSpecialEvent();
  }, []);

  async function handleSaveSpecialEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSpecialStatus("loading");
    setSpecialMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const isoDate = toIsoDateFromBr(specialDateInput);
      if (specialDateInput && !isoDate) {
        throw new Error("Data inválida. Use o formato dd/MM/aaaa.");
      }
      const payload = {
        key: "special_event",
        value: JSON.stringify({
          ...specialEvent,
          date: isoDate ?? ""
        })
      };
      const { error } = await supabaseClient.from("app_settings").upsert(payload);
      if (error) throw error;
      setSpecialStatus("success");
      setSpecialMessage("Evento especial atualizado.");
    } catch (error) {
      setSpecialStatus("error");
      setSpecialMessage((error as Error).message);
    }
  }

  return (
    <form className="card space-y-4 p-4" onSubmit={handleSaveSpecialEvent}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-900">Evento especial</p>
          <p className="text-xs text-text-muted">Destaque eventos anuais como o Conjadem na home.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={specialEvent.is_active}
              onChange={(event) =>
                setSpecialEvent((prev) => ({ ...prev, is_active: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Ativo
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={specialEvent.is_non_recurring}
              onChange={(event) =>
                setSpecialEvent((prev) => ({ ...prev, is_non_recurring: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Não recorrente
          </label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-text">Título</span>
          <input
            value={specialEvent.title}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Conjadem 2026"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Tag</span>
          <input
            value={specialEvent.tag}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, tag: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Evento anual"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Subtítulo</span>
          <input
            value={specialEvent.subtitle}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, subtitle: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Congresso de Jovens"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Data</span>
          <input
            value={specialDateInput}
            onChange={(event) => setSpecialDateInput(event.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="dd/MM/aaaa"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Local</span>
          <input
            value={specialEvent.location}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, location: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Templo Sede"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Imagem (URL)</span>
          <input
            value={specialEvent.image_url}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, image_url: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="https://..."
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">CTA (texto)</span>
          <input
            value={specialEvent.cta_label}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, cta_label: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Saiba mais"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">CTA (link)</span>
          <input
            value={specialEvent.cta_url}
            onChange={(event) => setSpecialEvent((prev) => ({ ...prev, cta_url: event.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="https://..."
          />
        </label>
      </div>
      <button
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        disabled={specialStatus === "loading"}
      >
        {specialStatus === "loading" ? "Salvando..." : "Salvar evento"}
      </button>
      {specialStatus === "error" ? (
        <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
          {specialMessage || "Não foi possível salvar o evento."}
        </p>
      ) : null}
      {specialStatus === "success" ? (
        <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
          {specialMessage}
        </p>
      ) : null}
    </form>
  );
}
