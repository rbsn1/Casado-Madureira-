"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";

type ScheduleItem = {
  title: string;
  meta: string;
};

type WeeklyEvent = Record<string, any>;

type LoginStatus = "idle" | "loading" | "error";

type ScheduleStatus = "idle" | "loading" | "error";

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
  const meta = [day, time, location].filter(Boolean).join(" • ");

  return {
    title,
    meta: meta || "Agenda semanal atualizada pela equipe."
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>("loading");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

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
        .limit(4);

      if (!active) return;

      if (error) {
        setScheduleStatus("error");
        setScheduleItems([]);
        return;
      }

      const items = (data ?? []).map((item) => formatScheduleItem(item as WeeklyEvent));
      setScheduleItems(items.slice(0, 4));
      setScheduleStatus("idle");
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = emailValue || String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("idle");
    router.push("/");
  }

  async function handlePasswordReset() {
    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }
    if (!emailValue) {
      setStatus("error");
      setMessage("Digite seu e-mail para receber o link de recuperação.");
      return;
    }
    setStatus("loading");
    setMessage("");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(emailValue, {
      redirectTo: `${window.location.origin}/reset`
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("idle");
    setMessage("Enviamos um link de recuperação para o seu e-mail.");
  }

  const scheduleFallback = useMemo(() => {
    if (scheduleStatus === "loading") return "Carregando agenda...";
    if (scheduleStatus === "error") return "Agenda em atualização";
    return "Agenda em atualização";
  }, [scheduleStatus]);

  return (
    <PortalBackground heroImageSrc="/portal-hero.jpg" heroHeight="560px">
      {/* Substitua /public/portal-hero.jpg pela imagem final do mock. */}
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
            <Link
              href="/login"
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
          </div>
        </header>

        <section className="grid items-center gap-10 pt-12 lg:grid-cols-[1.1fr_0.9fr]">
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

          <div className={`${cardClass} p-6`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Acesso interno</p>
            <h2 className="mt-2 text-2xl font-semibold text-emerald-900">Entre no painel</h2>
            <p className="mt-2 text-sm text-slate-600">
              Utilize seu e-mail institucional para acompanhar cadastros, relatórios e times.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@casados.com"
                  value={emailValue}
                  onChange={(event) => setEmailValue(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  Manter conectado
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="font-semibold text-emerald-800 hover:text-emerald-900"
                >
                  Esqueci minha senha
                </button>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Entrando..." : "Entrar"}
              </button>
              {status === "error" ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {message || "Nao foi possivel entrar. Verifique suas credenciais."}
                </p>
              ) : null}
              {status === "idle" && message ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {message}
                </p>
              ) : null}
            </form>
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
          <div className="mt-6 grid gap-4 md:grid-cols-3">
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

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-emerald-600">Agenda semanal</p>
                <Link href="/agenda" className="text-xs font-semibold text-emerald-800">
                  Ver agenda completa →
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {scheduleItems.length ? (
                  scheduleItems.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.meta}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{scheduleFallback}</p>
                )}
              </div>
            </div>

            <Link href="/login" className={`${cardClass} transition hover:-translate-y-0.5`}>
              <p className="text-xs font-semibold uppercase text-emerald-600">Painel interno</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">Acesso interno</p>
              <p className="mt-2 text-sm text-slate-600">
                Controle completo de cadastros, relatórios e equipes em um unico painel.
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-800">
                Entrar no painel →
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
