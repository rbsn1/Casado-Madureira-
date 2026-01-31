"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";

type ScheduleItem = {
  title: string;
  meta: string;
  description?: string;
};

type WeeklyEvent = Record<string, any>;

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-5 shadow-lg shadow-black/5 backdrop-blur";

function formatTime(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return String(value);
}

function formatScheduleItem(event: WeeklyEvent): ScheduleItem {
  const title =
    event.title ||
    event.titulo ||
    event.nome ||
    event.name ||
    event.evento ||
    "Encontro";
  const day =
    event.day ||
    event.dia ||
    event.dia_semana ||
    event.weekday ||
    event.week_day ||
    "";
  const time = formatTime(
    event.time || event.horario || event.starts_at || event.start_time || event.startTime
  );
  const location = event.location || event.local || event.endereco || event.place || "";
  const description = event.description || event.descricao || event.obs || event.observacoes || "";
  const meta = [day, time, location].filter(Boolean).join(" • ");

  return {
    title,
    meta: meta || "Agenda semanal atualizada pela equipe.",
    description: description || undefined
  };
}

export default function AgendaPage() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      if (!supabaseClient) {
        if (active) setStatus("error");
        return;
      }

      const { data, error } = await supabaseClient
        .from("weekly_schedule_events")
        .select("*")
        .eq("is_active", true)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (!active) return;

      if (error) {
        setStatus("error");
        setItems([]);
        return;
      }

      const formatted = (data ?? []).map((item) => formatScheduleItem(item as WeeklyEvent));
      setItems(formatted);
      setStatus("idle");
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, []);

  const emptyMessage = useMemo(() => {
    if (status === "loading") return "Carregando agenda...";
    return "Agenda em atualização";
  }, [status]);

  return (
    <PortalBackground heroImageSrc="/portal-hero.jpg" heroHeight="420px">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600/90 text-xs font-semibold text-white">
              CCM
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Portal CCM
              </p>
              <p className="text-sm font-semibold text-emerald-900">Agenda semanal</p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            Acesso interno
          </Link>
        </header>

        <section className="pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Programacao
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-emerald-900 sm:text-4xl">
                Agenda semanal CCM
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Confira os encontros e eventos ativos. Caso nao apareca, a agenda esta em
                atualizacao.
              </p>
            </div>
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-900"
            >
              Voltar ao portal →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {items.length ? (
              items.map((item, index) => (
                <div key={`${item.title}-${index}`} className={cardClass}>
                  <p className="text-xs font-semibold uppercase text-emerald-600">Encontro</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.meta}</p>
                  {item.description ? (
                    <p className="mt-3 text-sm text-slate-500">{item.description}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className={`${cardClass} md:col-span-2`}>
                <p className="text-sm text-slate-500">{emptyMessage}</p>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-16 border-t border-black/5 pb-10 pt-6 text-sm text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Portal CCM • Casados com a Madureira</p>
            <p>Agenda semanal para apoio dos departamentos.</p>
          </div>
        </footer>
      </div>
    </PortalBackground>
  );
}
