"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { HelpChatWidget } from "@/components/shared/HelpChatWidget";
import { formatDateBR } from "@/lib/date";

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

const cardClass =
  "rounded-2xl border border-black/5 bg-white/85 p-5 shadow-xl shadow-black/10 backdrop-blur-lg ring-1 ring-white/40";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const MANAUS_TIMEZONE = "America/Manaus";

function getNowInTimeZone(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  return new Date(year, month - 1, day, hour, minute, second);
}

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
      label: results.length === 0 ? "Próximo" : "Seguinte",
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

  const formatted = formatDateBR(date);
  const [day = "--", month = "--", year = "----"] = formatted.split("/");

  return (
    <div className="flex h-20 w-20 flex-col overflow-hidden rounded-xl border border-black/5 bg-white/90 shadow-sm">
      <div className="h-2 bg-gradient-to-r from-emerald-500 to-sky-400" />
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-emerald-900">{day}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
          {month}/{year}
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
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [specialEvent, setSpecialEvent] = useState<SpecialEventConfig | null>(null);

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

  useEffect(() => {
    let active = true;

    async function loadSpecialEvent() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient
        .from("app_settings")
        .select("value")
        .eq("key", "special_event")
        .maybeSingle();
      if (!active) return;
      if (error) return;
      if (!data?.value) {
        setSpecialEvent(null);
        return;
      }
      try {
        const parsed = JSON.parse(data.value) as SpecialEventConfig;
        if (!parsed.is_active) {
          setSpecialEvent(null);
          return;
        }
        parsed.is_non_recurring = parsed.is_non_recurring ?? true;
        setSpecialEvent(parsed);
      } catch {
        setSpecialEvent(null);
      }
    }

    loadSpecialEvent();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRoles() {
      if (!supabaseClient || !user) {
        if (active) setUserRoles([]);
        return;
      }
      const { data } = await supabaseClient.rpc("get_my_roles");
      if (!active) return;
      setUserRoles((data ?? []) as string[]);
    }

    loadRoles();

    return () => {
      active = false;
    };
  }, [user]);

  const scheduleFallback = useMemo(() => {
    if (scheduleStatus === "loading") return "Carregando agenda...";
    return "Agenda em atualização";
  }, [scheduleStatus]);

  const nextEvents = useMemo(() => {
    if (!scheduleEvents.length) return [];
    const now = getNowInTimeZone(MANAUS_TIMEZONE);
    return getNextEvents(scheduleEvents, now, 4);
  }, [scheduleEvents]);

  const todayEvent = useMemo(() => {
    if (!scheduleEvents.length) return null;
    const now = getNowInTimeZone(MANAUS_TIMEZONE);
    return getTodayEvent(scheduleEvents, now);
  }, [scheduleEvents]);

  const filteredNextEvents = useMemo(() => {
    if (!todayEvent) return nextEvents;
    return nextEvents.filter((item) => item.meta !== formatEventLine(todayEvent));
  }, [nextEvents, todayEvent]);

  const badgeLabel = useMemo(() => {
    const updatedAt = nextEvents[0]?.updatedAt;
    if (updatedAt && isSameDay(updatedAt, getNowInTimeZone(MANAUS_TIMEZONE))) {
      return "Atualizado hoje";
    }
    return "Esta semana";
  }, [nextEvents]);

  const isCadastrador = userRoles.includes("CADASTRADOR");

  return (
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="560px">
      {/* Substitua /public/hero-community.jpg pela imagem final do mock. */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 sm:pb-16">
        <header className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <nav className="hidden items-center gap-6 text-sm text-emerald-900/70 md:flex">
              <Link href="/agenda" className="transition hover:text-emerald-900">
                Agenda
              </Link>
              <Link href="/cadastro" className="transition hover:text-emerald-900">
                Cadastro
              </Link>
            </nav>
            {authLoading ? (
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-900 sm:w-auto">
                Carregando...
              </div>
            ) : user ? (
              <Link
                href={role === "admin" ? "/admin" : "/conta"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 sm:w-auto"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                {role === "admin" ? "Ir para o painel" : "Minha conta"}
              </Link>
            ) : (
              <Link
                href="/acesso-interno"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 sm:w-auto"
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

        <section className="grid items-center gap-6 pt-6 sm:pt-10 lg:grid-cols-1">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Bem-vindos
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-emerald-900/90 sm:text-5xl">
                  Portal de apoio aos casados com a Madureira
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-600/90">
                  O Portal CCM centraliza cadastros, agenda e acesso interno. Tudo em um ambiente leve,
                  organizado e pronto para apoiar os departamentos.
                </p>
              </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/agenda"
                className="w-full rounded-full border border-emerald-200 bg-white/80 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 sm:w-auto"
              >
                Ver agenda
              </Link>
              <Link
                href="/acesso-interno"
                className="w-full rounded-full border border-emerald-200 bg-white/80 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 sm:w-auto"
              >
                Acesso interno
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600/90">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Cadastro rápido em até 1 minuto
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Agenda semanal sempre atualizada
              </div>
            </div>
          </div>

        </section>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent sm:mt-12" />

        <section className="mt-8 sm:mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-2xl shadow-emerald-200/40 sm:rounded-3xl sm:p-6">
            <div className="pointer-events-none absolute -right-8 top-6 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-6 h-48 w-48 rounded-full bg-sky-200/50 blur-3xl" />

            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
              <div className="min-w-0 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                  Agenda da semana
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-emerald-900 sm:text-3xl">
                    Programação em destaque
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600/90">
                    Confira os próximos encontros, horários e destaque do dia para não perder nenhum momento.
                  </p>
                </div>
                {todayEvent ? (
                  <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                      Hoje
                    </p>
                    <p className="mt-2 text-base font-semibold text-emerald-900">
                      {(todayEvent.start_time ?? "--:--").slice(0, 5)} • {todayEvent.title}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href="/agenda"
                    className="w-full rounded-full bg-emerald-600 px-5 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                  >
                    Ver agenda completa
                  </Link>
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 sm:text-[11px]">
                    {badgeLabel}
                  </span>
                </div>
              </div>

              <div className="min-w-0 w-full rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-lg shadow-emerald-100/60 backdrop-blur sm:p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                      Próximos encontros
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">Agenda semanal</p>
                  </div>
                  <MiniCalendar date={nextEvents[0]?.date} />
                </div>

                <div className="mt-4 space-y-3">
                  {filteredNextEvents.length ? (
                    <>
                      {filteredNextEvents.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl bg-emerald-50/60 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                              {index === 0 ? "Próximo" : "Seguinte"}
                            </span>
                            {index === 0 ? (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
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
              </div>
            </div>
          </div>
        </section>

        {specialEvent ? (
          <section className="mt-6 sm:mt-10">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-900 p-4 text-white shadow-2xl shadow-emerald-900/30 sm:rounded-3xl sm:p-6">
              {specialEvent.image_url ? (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30"
                  style={{ backgroundImage: `url(${specialEvent.image_url})` }}
                  aria-hidden="true"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-emerald-900/70 to-sky-900/70" />
              <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
                <div className="space-y-4">
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                    {specialEvent.tag || "Evento especial"}
                  </span>
                  <div>
                    <h3 className="text-3xl font-semibold sm:text-4xl">{specialEvent.title}</h3>
                    {specialEvent.subtitle ? (
                      <p className="mt-2 text-sm text-emerald-100/90">{specialEvent.subtitle}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-emerald-100/90">
                    {specialEvent.date ? (
                      <span>
                        📅{" "}
                        {formatDateBR(specialEvent.date)
                          ? formatDateBR(specialEvent.date)
                          : specialEvent.date}
                      </span>
                    ) : null}
                    {specialEvent.location ? <span>📍 {specialEvent.location}</span> : null}
                    {specialEvent.is_non_recurring ? (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                        Especial • Não recorrente
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                  {specialEvent.cta_url && specialEvent.cta_label ? (
                    <Link
                      href={specialEvent.cta_url}
                      className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-emerald-900 shadow-lg shadow-white/20 transition hover:-translate-y-0.5"
                    >
                      {specialEvent.cta_label}
                    </Link>
                  ) : null}
                  <Link
                    href="/agenda"
                    className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white/90 transition hover:border-white"
                  >
                    Ver agenda →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 sm:mt-10">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50/70 to-white px-4 py-3 shadow-sm sm:rounded-3xl sm:px-6 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                Romanos 15:7
              </p>
              <p className="text-sm font-semibold text-emerald-900 sm:text-base">
                Portanto, acolhei-vos uns aos outros, como também Cristo nos acolheu para a glória de Deus.
              </p>
              <p className="text-xs text-slate-600/90">
                Texto base do nosso projeto de acolhimento.
              </p>
            </div>
          </div>
        </section>

        {user && isCadastrador ? (
          <section className="mt-6 sm:mt-10">
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-lg shadow-emerald-100/50 sm:rounded-3xl sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                Acesso interno
              </p>
              <p className="mt-3 text-lg font-semibold text-emerald-900">Cadastro rápido</p>
              <p className="mt-2 text-sm text-slate-600/90">
                Abra o formulário interno para cadastrar as pessoas da sala.
              </p>
              <Link
                href="/cadastro"
                className="mt-4 inline-flex items-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Abrir formulário →
              </Link>
            </div>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-black/5 pb-8 pt-5 text-sm text-slate-500 sm:mt-16 sm:pb-10 sm:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Portal CCM • Casados com a Madureira</p>
            <p>Central de apoio e integração aos casados com a Madureira</p>
          </div>
        </footer>
      </div>
      <HelpChatWidget />
    </PortalBackground>
  );
}
