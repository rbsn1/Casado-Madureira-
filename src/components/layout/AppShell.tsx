"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  getAuthScope,
  getDiscipuladoHomePath,
  hasDiscipuladoAccessRole,
  isDiscipuladoScopedAccount
} from "@/lib/authScope";

type NavItem = {
  href: string;
  label: string;
  roles?: string[];
};

type NavGlyphName =
  | "dashboard"
  | "cadastro"
  | "list"
  | "agenda"
  | "report"
  | "admin"
  | "manual"
  | "fila"
  | "discipulado";

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Casados com a Madureira",
    items: [
      { href: "/", label: "Dashboard", roles: ["ADMIN_MASTER","PASTOR","SECRETARIA","NOVOS_CONVERTIDOS","LIDER_DEPTO","VOLUNTARIO"] },
      { href: "/cadastro", label: "Cadastro", roles: ["CADASTRADOR"] },
      { href: "/cadastros", label: "Cadastros", roles: ["ADMIN_MASTER","SECRETARIA","NOVOS_CONVERTIDOS","LIDER_DEPTO","VOLUNTARIO"] },
      { href: "/admin/agenda-semanal", label: "Agenda semanal", roles: ["ADMIN_MASTER"] },
      { href: "/relatorios", label: "Relatórios", roles: ["ADMIN_MASTER","SECRETARIA"] },
      { href: "/admin/whatsapp", label: "WhatsApp", roles: ["ADMIN_MASTER","SUPER_ADMIN","SECRETARIA"] },
      { href: "/admin", label: "Admin", roles: ["ADMIN_MASTER"] },
      { href: "/manual/guia-pratico", label: "Manual do sistema" },
      { href: "/manual/jornada-completa", label: "Manual técnico" }
    ]
  },
  {
    title: "Discipulado",
    items: [
      { href: "/discipulado", label: "Dashboard", roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR"] },
      {
        href: "/discipulado/fila",
        label: "Fila",
        roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR", "SM_DISCIPULADO", "SECRETARIA_DISCIPULADO"]
      },
      {
        href: "/discipulado/convertidos/novo",
        label: "Novo convertido",
        roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR", "SM_DISCIPULADO", "SECRETARIA_DISCIPULADO"]
      },
      {
        href: "/discipulado/manual",
        label: "Manual",
        roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR", "SM_DISCIPULADO", "SECRETARIA_DISCIPULADO"]
      },
      { href: "/discipulado/convertidos", label: "Convertidos", roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR"] },
      { href: "/discipulado/departamentos", label: "Departamentos", roles: ["ADMIN_DISCIPULADO", "DISCIPULADOR"] },
      { href: "/discipulado/admin", label: "Admin", roles: ["ADMIN_DISCIPULADO"] }
    ]
  },
  {
    title: "Novos Convertidos (Legado)",
    items: [
      { href: "/novos-convertidos/dashboard", label: "Dashboard", roles: ["ADMIN_MASTER","SECRETARIA","NOVOS_CONVERTIDOS"] },
      { href: "/novos-convertidos", label: "Fila", roles: ["ADMIN_MASTER","SECRETARIA","NOVOS_CONVERTIDOS"] }
    ]
  }
];

function getNavGlyph(href: string): NavGlyphName {
  if (href === "/" || href.endsWith("/dashboard") || href === "/discipulado") return "dashboard";
  if (href.includes("/cadastro") && !href.includes("/cadastros")) return "cadastro";
  if (href.includes("/cadastros") || href.includes("/convertidos")) return "list";
  if (href.includes("/agenda")) return "agenda";
  if (href.includes("/relatorios")) return "report";
  if (href.includes("/admin")) return "admin";
  if (href.includes("/fila") || href.includes("/novos-convertidos")) return "fila";
  if (href.includes("/manual")) return "manual";
  return "discipulado";
}

function NavGlyph({ name, className }: { name: NavGlyphName; className?: string }) {
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M3 12.5 12 4l9 8.5" />
          <path d="M6 10.6V20h12v-9.4" />
        </svg>
      );
    case "cadastro":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          <path d="M19 6v4M17 8h4" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M8 6h12M8 12h12M8 18h12" />
          <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "agenda":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.6" />
          <path d="M3.5 9.2h17M8 3.8v2.8M16 3.8v2.8" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M4 20V6.8a1.8 1.8 0 0 1 1.8-1.8h12.4A1.8 1.8 0 0 1 20 6.8V20Z" />
          <path d="M8 16.5v-4M12 16.5v-7M16 16.5v-2.5" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="m12 3 7 3.5v5.2c0 4-2.4 7-7 9.3-4.6-2.3-7-5.3-7-9.3V6.5Z" />
          <path d="M9.4 12.2 11.2 14l3.5-3.5" />
        </svg>
      );
    case "manual":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
          <path d="M4 5.5v15M8.5 7.5h7M8.5 11h7" />
        </svg>
      );
    case "fila":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M5 7h10M5 12h14M5 17h9" />
          <path d="m15 5 4 2-4 2" />
        </svg>
      );
    case "discipulado":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M12 3.4c1.7 3.2 5 5 5 9.3a5 5 0 0 1-10 0c0-2.5 1.3-4.4 2.6-6.2C10.4 5.5 11.1 4.5 12 3.4Z" />
        </svg>
      );
  }
}

export function AppShell({ children, activePath }: { children: ReactNode; activePath?: string }) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const hasCadastroDiscipuladoRole =
    roles.includes("SM_DISCIPULADO") || roles.includes("SECRETARIA_DISCIPULADO");
  const isCadastradorOnly = !isGlobalAdmin && roles.length === 1 && roles.includes("CADASTRADOR");
  const isDiscipuladoAccount = isDiscipuladoScopedAccount(roles, isGlobalAdmin);
  const hasDiscipuladoRole = hasDiscipuladoAccessRole(roles);
  const isDiscipuladoConsole = current.startsWith("/discipulado");
  const shouldMaskContent = !authResolved || (isDiscipuladoAccount && !isDiscipuladoConsole);
  const accessRoleHint =
    isDiscipuladoAccount && !isGlobalAdmin
      ? "RBAC: ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO, SECRETARIA_DISCIPULADO"
      : "RBAC: ADMIN_MASTER, SUPER_ADMIN, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO, CADASTRADOR, ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO, SECRETARIA_DISCIPULADO";

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessItem(item))
    }))
    .filter((section) => section.items.length > 0);
  const mobileQuickItems = visibleSections
    .flatMap((section) => section.items)
    .filter((item) => !item.href.includes("/manual") && !item.href.includes("/admin"))
    .slice(0, 4);

  function canAccessItem(item: NavItem) {
    if (item.href.startsWith("/discipulado")) {
      if (!hasDiscipuladoRole) return false;
      if (!item.roles?.length) return true;
      return item.roles.some((role) => roles.includes(role));
    }
    if (isGlobalAdmin) return true;
    if (isDiscipuladoAccount) return item.href.startsWith("/discipulado");
    if (!item.roles?.length) return true;
    return item.roles.some((role) => roles.includes(role));
  }

  function isItemActive(href: string) {
    if (current === href) return true;
    if (href === "/") return current === "/";
    return current.startsWith(`${href}/`);
  }

  useEffect(() => {
    let active = true;
    setAuthResolved(false);

    async function loadUser() {
      if (!supabaseClient) {
        if (active) setAuthResolved(true);
        return;
      }
      const { data } = await supabaseClient.auth.getUser();
      if (!active) return;
      if (!data.user) {
        const loginPath = current.startsWith("/discipulado") ? "/discipulado/login" : "/acesso-interno";
        setAuthResolved(true);
        router.replace(loginPath);
        return;
      }
      setUserEmail(data.user.email ?? null);
      const scope = await getAuthScope();
      if (!active) return;
      const nextRoles = scope.roles;
      const nextIsGlobalAdmin = scope.isAdminMaster;
      const nextIsDiscipuladoAccount = isDiscipuladoScopedAccount(nextRoles, nextIsGlobalAdmin);
      setRoles(nextRoles);
      setIsGlobalAdmin(nextIsGlobalAdmin);
      setAuthResolved(true);
      if (nextIsDiscipuladoAccount && !current.startsWith("/discipulado")) {
        router.replace(getDiscipuladoHomePath(nextRoles));
        return;
      }
      if (nextRoles.length === 1 && nextRoles.includes("CADASTRADOR") && current === "/") {
        router.replace("/cadastro");
      }
    }

    loadUser();

    if (!supabaseClient) return () => {};

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, current]);

  async function handleLogout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    const loginPath = current.startsWith("/discipulado") ? "/discipulado/login" : "/acesso-interno";
    router.push(loginPath);
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;
    setPasswordStatus("loading");
    setPasswordMessage("");
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (!password || password.length < 6) {
      setPasswordStatus("error");
      setPasswordMessage("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setPasswordStatus("error");
      setPasswordMessage("As senhas não conferem.");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      setPasswordStatus("error");
      setPasswordMessage(error.message);
      return;
    }
    setPasswordStatus("success");
    setPasswordMessage("Senha atualizada com sucesso.");
    event.currentTarget.reset();
  }

  return (
    <div className={clsx("app-shell", isDiscipuladoConsole && "discipulado-console-shell")}>
      {!isCadastradorOnly ? (
        <aside
          className={clsx(
            "hidden lg:block border-r text-white",
            isDiscipuladoConsole
              ? "border-slate-900 bg-slate-950"
              : "border-brand-900 bg-gradient-to-b from-brand-900 via-brand-900 to-[#243f61]"
          )}
        >
          <div className="sticky top-0 flex h-screen flex-col gap-6 p-5">
            <Link href={isDiscipuladoConsole ? "/discipulado" : "/"} className="flex items-center gap-3">
              <div
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-inner",
                  isDiscipuladoConsole ? "bg-sky-600" : "bg-accent-600"
                )}
              >
                {isDiscipuladoConsole ? "DC" : "CM"}
              </div>
              <div>
                <p className={clsx("text-sm", isDiscipuladoConsole ? "text-slate-300" : "text-brand-100/90")}>SaaS</p>
                <p className="text-lg font-semibold text-white">
                  {isDiscipuladoConsole ? "Portal Discipulado" : "Casados com a Madureira"}
                </p>
              </div>
            </Link>
            <nav className="flex-1 space-y-5">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  <p
                    className={clsx(
                      "mb-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                      isDiscipuladoConsole ? "text-slate-300/90" : "text-brand-100/80"
                    )}
                  >
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href);
                      const icon = getNavGlyph(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={clsx(
                              "group flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:text-white",
                              isDiscipuladoConsole ? "hover:bg-sky-800/65" : "hover:bg-white/10",
                              active
                                ? isDiscipuladoConsole
                                  ? "bg-sky-700/90 text-white shadow-[0_12px_28px_rgba(14,116,144,0.35)] ring-1 ring-white/20"
                                  : "bg-white/14 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)] ring-1 ring-white/20"
                                : isDiscipuladoConsole
                                  ? "text-slate-200/90"
                                  : "text-brand-100/90"
                            )}
                          >
                            <span
                              className={clsx(
                                "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-white/8 text-white/85 group-hover:bg-white/15 group-hover:text-white"
                              )}
                              aria-hidden="true"
                            >
                              <NavGlyph name={icon} />
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div
              className={clsx(
                "rounded-xl p-4 shadow-sm ring-1",
                isDiscipuladoConsole
                  ? "bg-slate-900/60 ring-sky-800/60"
                  : "bg-white/8 ring-white/15"
              )}
            >
              <p className="text-sm font-semibold text-white">Acesso interno</p>
              <p className={clsx("text-xs", isDiscipuladoConsole ? "text-slate-300" : "text-brand-100/90")}>
                {accessRoleHint}
              </p>
            </div>
          </div>
        </aside>
      ) : null}
      <main
        className={clsx(
          "min-h-screen",
          !isCadastradorOnly && "pb-24 lg:pb-0",
          isDiscipuladoConsole ? "bg-gradient-to-b from-slate-50 via-sky-50/35 to-white" : "bg-white"
        )}
      >
        <div className="mx-auto max-w-[88rem] px-4 py-5 sm:px-5 sm:py-8 lg:px-10 xl:px-12">
          <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={clsx("text-sm", isDiscipuladoConsole ? "text-sky-700" : "text-text-muted")}>
                {isDiscipuladoConsole ? "Portal Discipulado" : "Casados com a Madureira"}
              </p>
              <h1 className={clsx("text-xl font-semibold sm:text-2xl", isDiscipuladoConsole ? "text-sky-950" : "text-text")}>
                {isCadastradorOnly
                  ? "Cadastro"
                  : isDiscipuladoAccount
                    ? "Painel Discipulado"
                    : hasCadastroDiscipuladoRole
                    ? "Cadastro de Convertidos"
                    : isDiscipuladoConsole
                      ? "Painel Discipulado"
                      : "Painel Interno"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isCadastradorOnly ? (
                <button
                  type="button"
                  onClick={() => setShowMobileNav(true)}
                  className={clsx(
                    "inline-flex items-center justify-center rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm lg:hidden",
                    isDiscipuladoConsole
                      ? "border-sky-100 text-sky-900 hover:border-sky-500 hover:text-sky-950"
                      : "border-brand-100 text-brand-900 hover:border-brand-700 hover:text-brand-900"
                  )}
                >
                  Menu
                </button>
              ) : null}
              <div
                className={clsx(
                  "max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:max-w-[22rem] sm:px-4 sm:text-sm",
                  isDiscipuladoConsole ? "bg-sky-100 text-sky-900" : "bg-brand-100 text-brand-900"
                )}
              >
                <span className="truncate">{userEmail ? `Conectado: ${userEmail}` : "Sessão ativa"}</span>
              </div>
              {!isCadastradorOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setPasswordStatus("idle");
                    setPasswordMessage("");
                  }}
                  className={clsx(
                    "rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
                    isDiscipuladoConsole
                      ? "border-sky-100 text-sky-900 hover:border-sky-500 hover:text-sky-950"
                      : "border-brand-100 text-brand-900 hover:border-brand-700 hover:text-brand-900"
                  )}
                >
                  Alterar senha
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className={clsx(
                  "rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
                  isDiscipuladoConsole
                    ? "border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-900"
                    : "border-border text-text-muted hover:border-brand-100 hover:text-brand-900"
                )}
              >
                Sair
              </button>
            </div>
          </header>
          {shouldMaskContent ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Carregando ambiente...
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      {showMobileNav ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileNav(false)}
            aria-hidden="true"
          />
          <div
            className={clsx(
              "absolute left-0 top-0 h-full w-[86vw] max-w-xs text-white shadow-xl",
              isDiscipuladoConsole ? "bg-slate-950" : "bg-brand-900"
            )}
          >
            <div
              className={clsx(
                "flex items-center justify-between border-b px-4 py-4",
                isDiscipuladoConsole ? "border-slate-800" : "border-brand-800"
              )}
            >
              <span className={clsx("text-sm font-semibold", isDiscipuladoConsole ? "text-slate-200" : "text-brand-100")}>Menu</span>
              <button
                type="button"
                onClick={() => setShowMobileNav(false)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs hover:bg-opacity-100",
                  isDiscipuladoConsole
                    ? "border-slate-700/60 text-slate-200 hover:bg-slate-800"
                    : "border-brand-700/60 text-brand-100 hover:bg-brand-800"
                )}
              >
                Fechar
              </button>
            </div>
            <nav className="space-y-6 px-4 py-5">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  <p
                    className={clsx(
                      "mb-2 text-xs font-semibold uppercase tracking-wide",
                      isDiscipuladoConsole ? "text-slate-300/90" : "text-brand-100/80"
                    )}
                  >
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href);
                      const icon = getNavGlyph(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setShowMobileNav(false)}
                            className={clsx(
                              "group flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition hover:text-white",
                              isDiscipuladoConsole ? "hover:bg-sky-800/80" : "hover:bg-brand-700/80",
                              active
                                ? isDiscipuladoConsole
                                  ? "bg-sky-700 text-white shadow-[0_10px_24px_rgba(14,116,144,0.35)] ring-1 ring-white/20"
                                  : "bg-brand-700 text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)] ring-1 ring-white/20"
                                : isDiscipuladoConsole
                                  ? "text-slate-200/90"
                                  : "text-brand-100/90"
                            )}
                          >
                            <span
                              className={clsx(
                                "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-white/10 text-white/85 group-hover:bg-white/15 group-hover:text-white"
                              )}
                              aria-hidden="true"
                            >
                              <NavGlyph name={icon} />
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
      {!isCadastradorOnly ? (
        <div
          className={clsx(
            "fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur lg:hidden",
            isDiscipuladoConsole ? "border-sky-100" : "border-brand-100"
          )}
        >
          <nav
            className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.45rem)" }}
          >
            {mobileQuickItems.map((item) => {
              const active = isItemActive(item.href);
              const icon = getNavGlyph(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                    active
                      ? isDiscipuladoConsole
                        ? "bg-sky-100 text-sky-900"
                        : "bg-brand-100 text-brand-900"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full",
                      active
                        ? isDiscipuladoConsole
                          ? "bg-sky-200 text-sky-900"
                          : "bg-brand-200 text-brand-900"
                        : "bg-slate-100 text-slate-500"
                    )}
                    aria-hidden="true"
                  >
                    <NavGlyph name={icon} />
                  </span>
                  <span className="w-full truncate text-center">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setShowMobileNav(true)}
              className={clsx(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                isDiscipuladoConsole
                  ? "text-sky-700 hover:bg-sky-50"
                  : "text-brand-800 hover:bg-brand-50"
              )}
            >
              <span
                className={clsx(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full",
                  isDiscipuladoConsole ? "bg-sky-100 text-sky-800" : "bg-brand-100 text-brand-800"
                )}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </span>
              <span>Menu</span>
            </button>
          </nav>
        </div>
      ) : null}
      {showPasswordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className={clsx("text-lg font-semibold", isDiscipuladoConsole ? "text-sky-950" : "text-emerald-900")}>
                Alterar senha
              </h2>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className={clsx(
                  "rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600",
                  isDiscipuladoConsole ? "hover:border-sky-200 hover:text-sky-900" : "hover:border-emerald-200 hover:text-emerald-900"
                )}
              >
                Fechar
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handlePasswordChange}>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Nova senha</span>
                <input
                  name="password"
                  type="password"
                  className={clsx(
                    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none",
                    isDiscipuladoConsole ? "focus:border-sky-400" : "focus:border-emerald-400"
                  )}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Confirmar senha</span>
                <input
                  name="confirm"
                  type="password"
                  className={clsx(
                    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none",
                    isDiscipuladoConsole ? "focus:border-sky-400" : "focus:border-emerald-400"
                  )}
                />
              </label>
              <button
                type="submit"
                className={clsx(
                  "w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70",
                  isDiscipuladoConsole ? "bg-sky-700 hover:bg-sky-800" : "bg-emerald-600 hover:bg-emerald-700"
                )}
                disabled={passwordStatus === "loading"}
              >
                {passwordStatus === "loading" ? "Salvando..." : "Salvar nova senha"}
              </button>
              {passwordStatus === "error" ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {passwordMessage || "Não foi possível atualizar a senha."}
                </p>
              ) : null}
              {passwordStatus === "success" ? (
                <p
                  className={clsx(
                    "rounded-lg px-3 py-2 text-xs",
                    isDiscipuladoConsole
                      ? "border border-sky-200 bg-sky-50 text-sky-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  {passwordMessage}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
