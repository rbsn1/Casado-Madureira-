"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  | "fila";

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
  }
];

function getNavGlyph(href: string): NavGlyphName {
  if (href === "/" || href.endsWith("/dashboard")) return "dashboard";
  if (href.includes("/cadastro") && !href.includes("/cadastros")) return "cadastro";
  if (href.includes("/cadastros") || href.includes("/convertidos")) return "list";
  if (href.includes("/confraternizacao")) return "agenda";
  if (href.includes("/escalas") || href.includes("/escala")) return "agenda";
  if (href.includes("/agenda")) return "agenda";
  if (href.includes("/relatorios")) return "report";
  if (href.includes("/admin")) return "admin";
  if (href.includes("/fila") || href.includes("/novos-convertidos")) return "fila";
  return "manual";
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
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={clsx("h-3.5 w-3.5", className)} aria-hidden="true">
          <path d="M5 7h10M5 12h14M5 17h9" />
          <path d="m15 5 4 2-4 2" />
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
  const isCadastradorOnly = !isGlobalAdmin && roles.length === 1 && roles.includes("CADASTRADOR");
  const accessRoleHint = "RBAC: ADMIN_MASTER, SUPER_ADMIN, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO, CADASTRADOR";

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
    if (isGlobalAdmin) return true;
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
        setAuthResolved(true);
        router.replace("/acesso-interno");
        return;
      }
      setUserEmail(data.user.email ?? null);
      const scope = await getAuthScope();
      if (!active) return;
      const nextRoles = scope.roles;
      const nextIsGlobalAdmin = scope.isAdminMaster;
      setRoles(nextRoles);
      setIsGlobalAdmin(nextIsGlobalAdmin);
      setAuthResolved(true);
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
    router.push("/acesso-interno");
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
    <div className="app-shell">
      <aside className="hidden lg:block border-r text-white border-brand-900 bg-gradient-to-b from-brand-900 via-brand-900 to-[#243f61]">
          <div className="sticky top-0 flex h-screen flex-col gap-6 p-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-inner">
                CM
              </div>
              <div>
                <p className="text-sm text-brand-100/90">SaaS</p>
                <p className="text-lg font-semibold text-white">Casados com a Madureira</p>
              </div>
            </Link>
            <nav className="flex-1 space-y-5">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-100/80">
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href);
                      const icon = getNavGlyph(item.href);
                      return (
                        <li key={item.href} className="flex items-center gap-1 rounded-full transition">
                          <Link
                            href={item.href}
                            className={clsx(
                              "group flex flex-1 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:text-white hover:bg-white/10",
                              active
                                ? "bg-white/14 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)] ring-1 ring-white/20"
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
            <div className="rounded-xl p-4 shadow-sm ring-1 bg-white/8 ring-white/15">
              <p className="text-sm font-semibold text-white">Acesso interno</p>
              <p className="text-xs text-brand-100/90">{accessRoleHint}</p>
            </div>
          </div>
      </aside>
      <main className="min-h-screen pb-24 lg:pb-0 bg-white">
        <div className="mx-auto max-w-[88rem] px-4 py-5 sm:px-5 sm:py-8 lg:px-10 xl:px-12">
          <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm text-text-muted">Casados com a Madureira</p>
                <h1 className="text-xl font-semibold sm:text-2xl text-text">
                  {isCadastradorOnly ? "Cadastro" : "Painel Interno"}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMobileNav(true)}
                className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm lg:hidden border-brand-100 text-brand-900 hover:border-brand-700 hover:text-brand-900"
              >
                Menu
              </button>
              <div className="max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:max-w-[22rem] sm:px-4 sm:text-sm bg-brand-100 text-brand-900">
                <span className="truncate">{userEmail ? `Conectado: ${userEmail}` : "Sessão ativa"}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordStatus("idle");
                  setPasswordMessage("");
                }}
                className="rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm border-brand-100 text-brand-900 hover:border-brand-700 hover:text-brand-900"
              >
                Alterar senha
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border bg-white px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm border-border text-text-muted hover:border-brand-100 hover:text-brand-900"
              >
                Sair
              </button>
            </div>
          </header>
          {!authResolved ? (
            <div className="rounded-2xl border border-border bg-bg p-4 text-sm text-text-muted">
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
          <div className="absolute left-0 top-0 h-full w-[86vw] max-w-xs text-white shadow-xl bg-brand-900">
            <div className="flex items-center justify-between border-b px-4 py-4 border-brand-800">
              <span className="text-sm font-semibold text-brand-100">Menu</span>
              <button
                type="button"
                onClick={() => setShowMobileNav(false)}
                className="rounded-full border px-3 py-1 text-xs hover:bg-opacity-100 border-brand-700/60 text-brand-100 hover:bg-brand-800"
              >
                Fechar
              </button>
            </div>
            <nav className="space-y-6 px-4 py-5">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-100/80">
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href);
                      const icon = getNavGlyph(item.href);
                      return (
                        <li key={item.href} className="flex items-center gap-1 rounded-full transition">
                          <Link
                            href={item.href}
                            onClick={() => setShowMobileNav(false)}
                            className={clsx(
                              "group flex flex-1 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition hover:text-white hover:bg-brand-700/80",
                              active
                                ? "bg-brand-700 text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)] ring-1 ring-white/20"
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur lg:hidden border-brand-100">
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
                    active ? "bg-brand-100 text-brand-900" : "text-text-muted hover:bg-surface hover:text-text"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full",
                      active ? "bg-brand-200 text-brand-900" : "bg-surface text-text-muted"
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
              className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition text-brand-800 hover:bg-brand-50"
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-800"
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
      <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Alterar senha">
        <form className="space-y-3" onSubmit={handlePasswordChange}>
          <label className="space-y-1 text-sm">
            <span className="text-text">Nova senha</span>
            <Input name="password" type="password" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Confirmar senha</span>
            <Input name="confirm" type="password" />
          </label>
          <Button type="submit" className="w-full" disabled={passwordStatus === "loading"}>
            {passwordStatus === "loading" ? "Salvando..." : "Salvar nova senha"}
          </Button>
          {passwordStatus === "error" ? (
            <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
              {passwordMessage || "Não foi possível atualizar a senha."}
            </p>
          ) : null}
          {passwordStatus === "success" ? (
            <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
              {passwordMessage}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
