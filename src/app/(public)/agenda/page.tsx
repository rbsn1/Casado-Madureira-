"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";

type WeeklyEvent = {
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  location: string | null;
  notes: string | null;
  is_active: boolean;
};

const weekdayLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-5 shadow-xl shadow-black/10 backdrop-blur-lg ring-1 ring-white/40";

function formatTime(value: string) {
  return value ? value.slice(0, 5) : "--:--";
}

export default function AgendaPage() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [items, setItems] = useState<WeeklyEvent[]>([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [query, setQuery] = useState("");

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
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (!active) return;

      if (error) {
        setStatus("error");
        setItems([]);
        return;
      }

      setItems((data ?? []) as WeeklyEvent[]);
      setStatus("idle");
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, []);

  const emptyMessage = useMemo(() => {
    if (status === "loading") return "Carregando agenda...";
    return "Programação será publicada em breve.";
  }, [status]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (onlyActive && !item.is_active) return false;
      if (normalizedQuery && !item.title.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [items, onlyActive, query]);

  const grouped = useMemo(() => {
    return weekdayLabels.map((label, weekday) => ({
      label,
      weekday,
      events: filteredItems.filter((item) => item.weekday === weekday)
    }));
  }, [filteredItems]);

  const todayIndex = new Date().getDay();

  return (
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="420px">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16">
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
            href="/acesso-interno"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            Acesso interno
          </Link>
        </header>

        <section className="pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Programação
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-emerald-900 sm:text-4xl">
                Agenda da semana
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Programação completa da igreja, organizada por dia da semana.
              </p>
            </div>
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-900"
            >
              Voltar ao portal →
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(event) => setOnlyActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mostrar apenas eventos ativos
            </label>
            <input
              placeholder="Buscar por título"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none"
            />
          </div>

          <div className="mt-8 space-y-6">
            {grouped.every((group) => group.events.length === 0) ? (
              <div className={cardClass}>
                <p className="text-sm text-slate-500">{emptyMessage}</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div
                  key={group.weekday}
                  className={`${cardClass} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/10 ${
                    group.weekday === todayIndex ? "border-emerald-200 bg-emerald-50/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-emerald-100/70 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-emerald-900">{group.label}</p>
                        {group.weekday === todayIndex ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Hoje
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {group.events.length
                          ? `${group.events.length} evento(s)`
                          : "Sem eventos programados"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{group.weekday === todayIndex ? "Destaque" : ""}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {group.events.length ? (
                      group.events.map((event) => (
                        <div key={event.id} className="rounded-xl bg-white/80 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="text-xs text-slate-500">
                            {event.location ? event.location : "Local a confirmar"}
                          </p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                              {formatTime(event.start_time)}
                            </span>
                          </div>
                          {event.notes ? (
                            <p className="mt-2 text-xs text-slate-500">{event.notes}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">
                        Ainda não temos encontros definidos para este dia.
                      </p>
                    )}
                  </div>
                </div>
              ))
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
