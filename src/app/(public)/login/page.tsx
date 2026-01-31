"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

type WeeklyEvent = {
  id?: string | number;
  title?: string;
  weekday?: number;
  start_time?: string;
  location?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  [key: string]: any;
};

type ScheduleLine = {
  label: string;
  title: string;
  meta: string;
  date: Date;
  updatedAt?: Date | null;
};

type ScheduleStatus = "idle" | "loading" | "error";

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-5 shadow-lg shadow-black/5 backdrop-blur";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;

function parseTimeToMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function formatEventLine(event: WeeklyEvent) {
  const weekday = Number(event.weekday ?? 0);
  const weekdayLabel = weekdayLabels[weekday] ?? "Dom";
  const time = event.start_time ? event.start_time.slice(0, 5) : "";
  const title = event.title || "Encontro";
  return `${weekdayLabel} • ${time || "--:--"} — ${title}`;
}

function getNextOccurrenceDate(event: WeeklyEvent, now: Date) {
  const weekday = Number(event.weekday ?? 0);
  const targetMinutes = parseTimeToMinutes(event.start_time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentWeekday = now.getDay();
  let delta = (weekday - currentWeekday + 7) % 7;

  if (delta === 0 && targetMinutes !== null && targetMinutes < nowMinutes) {
    delta = 7;
  }

  const date = new Date(now);
  date.setDate(now.getDate() + delta);
  if (targetMinutes !== null) {
    const hours = Math.floor(targetMinutes / 60);
    const minutes = targetMinutes % 60;
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function getNextEvents(events: WeeklyEvent[], now: Date, count = 4) {
  if (!events.length) return [];
  const withNextDate = events.map((event) => ({
    event,
    date: getNextOccurrenceDate(event, now)
  }));
  const sorted = withNextDate
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const results: ScheduleLine[] = [];
  while (results.length < count && sorted.length) {
    const index = results.length % sorted.length;
    const weekOffset = Math.floor(results.length / sorted.length);
    const base = sorted[index];
    const date = new Date(base.date.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);

    results.push({
      label: results.length === 0 ? "Proximo" : "Seguinte",
      title: base.event.title || "Encontro",
      meta: formatEventLine(base.event),
      date,
      updatedAt: base.event.updated_at ? new Date(base.event.updated_at) : null
    });
  }
  return results;
}

function getTodayEvent(events: WeeklyEvent[], now: Date) {
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayEvents = events.filter((event) => Number(event.weekday ?? 0) === today);
  if (!todayEvents.length) return null;
  const sorted = todayEvents
    .slice()
    .sort((a, b) => (parseTimeToMinutes(a.start_time) ?? 0) - (parseTimeToMinutes(b.start_time) ?? 0));
  const upcoming = sorted.find((event) => (parseTimeToMinutes(event.start_time) ?? 0) >= nowMinutes);
  return upcoming ?? sorted[0] ?? null;
}

function MiniCalendar({ date }: { date?: Date | null }) {
  if (!date) {
    return (
      <div className="flex h-20 w-20 flex-col overflow-hidden rounded-xl border border-black/5 bg-white/80 shadow-sm">
        <div className="h-2 bg-emerald-500" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-400">—</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400"> </span>
        </div>
      </div>
    );
  }

  const day = date.getDate();
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase();

  return (
    <div className="flex h-20 w-20 flex-col overflow-hidden rounded-xl border border-black/5 bg-white/90 shadow-sm">
      <div className="h-2 bg-gradient-to-r from-emerald-500 to-sky-400" />
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-emerald-900">{day}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
          {month}
        </span>
      </div>
    </div>
  );
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function LoginPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>("loading");
  const [scheduleEvents, setScheduleEvents] = useState<WeeklyEvent[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      if (!supabaseClient) {
        if (active) setScheduleStatus("error");
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
        setScheduleStatus("error");
        setScheduleEvents([]);
        return;
      }

      setScheduleEvents((data ?? []) as WeeklyEvent[]);
      setScheduleStatus("idle");
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, []);

  const scheduleFallback = useMemo(() => {
    if (scheduleStatus === "loading") return "Carregando agenda...";
    return "Agenda em atualização";
  }, [scheduleStatus]);

  const nextEvents = useMemo(() => {
    if (!scheduleEvents.length) return [];
    return getNextEvents(scheduleEvents, new Date(), 4);
  }, [scheduleEvents]);

  const todayEvent = useMemo(() => {
    if (!scheduleEvents.length) return null;
    return getTodayEvent(scheduleEvents, new Date());
  }, [scheduleEvents]);

  const filteredNextEvents = useMemo(() => {
    if (!todayEvent) return nextEvents;
    return nextEvents.filter((item) => item.meta !== formatEventLine(todayEvent));
  }, [nextEvents, todayEvent]);

  const badgeLabel = useMemo(() => {
    const updatedAt = nextEvents[0]?.updatedAt;
    if (updatedAt && isSameDay(updatedAt, new Date())) {
      return "Atualizado hoje";
    }
    return "Esta semana";
  }, [nextEvents]);

  return (
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="560px">
      {/* Substitua /public/hero-community.jpg pela imagem final do mock. */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/90 text-sm font-semibold text-white">
              CCM
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Portal CCM
              </p>
              <p className="text-sm font-semibold text-emerald-900">Casados com a Madureira</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="hidden items-center gap-6 text-sm text-emerald-900/70 md:flex">
              <Link href="/agenda" className="transition hover:text-emerald-900">
                Agenda
              </Link>
              <Link href="/cadastro" className="transition hover:text-emerald-900">
                Cadastro
              </Link>
              <Link href="/novos-convertidos/cadastro" className="transition hover:text-emerald-900">
                Novos convertidos
              </Link>
            </nav>
            {authLoading ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-900">
                Carregando...
              </div>
            ) : user ? (
              <Link
                href={role === "admin" ? "/admin" : "/conta"}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                {role === "admin" ? "Ir para o painel" : "Minha conta"}
              </Link>
            ) : (
              <Link
                href="/acesso-interno"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                  </svg>
                </span>
                Acesso interno
              </Link>
            )}
          </div>
        </header>

        <section className="grid items-center gap-10 pt-12 lg:grid-cols-1">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
              Bem-vindos
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-emerald-900 sm:text-5xl">
                Conecte o casal, fortaleça a comunidade.
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                O Portal CCM centraliza cadastros, agenda e acesso interno. Tudo em um ambiente leve,
                organizado e pronto para apoiar os departamentos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/cadastro"
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Cadastro rapido
              </Link>
              <Link
                href="/agenda"
                className="rounded-full border border-emerald-200 bg-white/80 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300"
              >
                Ver agenda
              </Link>
              <Link
                href="/acesso-interno"
                className="rounded-full border border-emerald-200 bg-white/80 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300"
              >
                Acesso interno
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Cadastro rapido em ate 1 minuto
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Agenda semanal sempre atualizada
              </div>
            </div>
          </div>

        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Acessos</p>
              <h3 className="mt-2 text-2xl font-semibold text-emerald-900">Tudo o que voce precisa</h3>
            </div>
            <p className="text-sm text-slate-600">Acesse recursos essenciais do portal CCM.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link href="/cadastro" className={`${cardClass} transition hover:-translate-y-0.5`}>
              <p className="text-xs font-semibold uppercase text-emerald-600">Cadastro rapido</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">Cadastro rapido do casal</p>
              <p className="mt-2 text-sm text-slate-600">
                Envie os dados do casal em menos de 1 minuto e acompanhe o contato da equipe.
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-800">
                Iniciar cadastro →
              </span>
            </Link>

            <Link
              href="/agenda"
              className={`${cardClass} agenda-card block border-t border-t-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:shadow-xl hover:shadow-black/10`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {badgeLabel}
                  </span>
                  <p className="mt-3 text-lg font-semibold text-slate-900">Agenda semanal</p>
                  <p className="mt-1 text-sm text-slate-600">Programacao da semana na igreja</p>
                </div>
                <MiniCalendar date={nextEvents[0]?.date} />
              </div>

              <div className="mt-5 space-y-3">
                {filteredNextEvents.length ? (
                  <>
                    {todayEvent ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-emerald-700">Hoje</span>
                          <span className="text-xs text-emerald-700">⏰</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-emerald-900">
                          Hoje • {(todayEvent.start_time ?? "--:--").slice(0, 5)} — {todayEvent.title}
                        </p>
                      </div>
                    ) : null}
                    {filteredNextEvents.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-emerald-600">
                            {index === 0 ? "Proximo" : "Seguinte"}
                          </span>
                          {index === 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Destaque
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.meta}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="rounded-xl bg-white/70 px-3 py-3">
                    <p className="text-sm text-slate-500">{scheduleFallback}</p>
                    <p className="mt-1 text-xs text-slate-400">—</p>
                  </div>
                )}
              </div>

              <span className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-800">
                Ver agenda completa →
              </span>
            </Link>

          </div>
        </section>

        <footer className="mt-16 border-t border-black/5 pb-10 pt-6 text-sm text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Portal CCM • Casados com a Madureira</p>
            <p>Central de apoio e integracao de casais.</p>
          </div>
        </footer>
      </div>
    </PortalBackground>
  );
}
