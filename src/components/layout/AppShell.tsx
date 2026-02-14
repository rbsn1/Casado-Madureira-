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

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Casados com a Madureira",
    items: [
      { href: "/", label: "Dashboard", roles: ["ADMIN_MASTER","PASTOR","SECRETARIA","NOVOS_CONVERTIDOS","LIDER_DEPTO","VOLUNTARIO"] },
      { href: "/cadastro", label: "Cadastro", roles: ["CADASTRADOR"] },
      { href: "/cadastros", label: "Cadastros", roles: ["ADMIN_MASTER","SECRETARIA","NOVOS_CONVERTIDOS","LIDER_DEPTO","VOLUNTARIO"] },
      { href: "/relatorios", label: "Relatórios", roles: ["ADMIN_MASTER","SECRETARIA"] },
      { href: "/admin", label: "Admin", roles: ["ADMIN_MASTER"] },
      { href: "/manual/jornada-completa", label: "Manual do sistema" }
    ]
  },
  {
    title: "Discipulado",
    items: [
      { href: "/discipulado", label: "Dashboard", roles: ["DISCIPULADOR"] },
      { href: "/discipulado/fila", label: "Fila", roles: ["DISCIPULADOR"] },
      {
        href: "/discipulado/convertidos/novo",
        label: "Novo convertido",
        roles: ["DISCIPULADOR", "SM_DISCIPULADO", "SECRETARIA_DISCIPULADO"]
      },
      { href: "/discipulado/convertidos", label: "Convertidos", roles: ["DISCIPULADOR"] },
      { href: "/discipulado/departamentos", label: "Departamentos", roles: ["DISCIPULADOR"] },
      { href: "/discipulado/admin", label: "Admin", roles: ["DISCIPULADOR"] }
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
      ? "RBAC: DISCIPULADOR, SM_DISCIPULADO, SECRETARIA_DISCIPULADO"
      : "RBAC: ADMIN_MASTER, SUPER_ADMIN, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO, CADASTRADOR, DISCIPULADOR, SM_DISCIPULADO, SECRETARIA_DISCIPULADO";

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessItem(item))
    }))
    .filter((section) => section.items.length > 0);

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
            isDiscipuladoConsole ? "border-slate-900 bg-slate-950" : "border-brand-900 bg-brand-900"
          )}
        >
          <div className="sticky top-0 flex h-screen flex-col gap-6 p-6">
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
            <nav className="flex-1 space-y-6">
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
                    {section.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={clsx(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:text-white",
                              isDiscipuladoConsole
                                ? "hover:bg-sky-800/80"
                                : "hover:bg-brand-700/80",
                              current === item.href
                                ? isDiscipuladoConsole
                                  ? "bg-sky-700 text-white shadow-sm"
                                  : "bg-brand-700 text-white shadow-sm"
                                : isDiscipuladoConsole
                                  ? "text-slate-200/90"
                                  : "text-brand-100/90"
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div
              className={clsx(
                "rounded-xl p-4 shadow-sm ring-1",
                isDiscipuladoConsole
                  ? "bg-slate-900/60 ring-sky-800/60"
                  : "bg-brand-700/40 ring-brand-700/60"
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
          isDiscipuladoConsole ? "bg-gradient-to-b from-slate-50 via-sky-50/35 to-white" : "bg-white"
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={clsx("text-sm", isDiscipuladoConsole ? "text-sky-700" : "text-text-muted")}>
                {isDiscipuladoConsole ? "Portal Discipulado" : "Casados com a Madureira"}
              </p>
              <h1 className={clsx("text-2xl font-semibold", isDiscipuladoConsole ? "text-sky-950" : "text-text")}>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isCadastradorOnly ? (
                <button
                  type="button"
                  onClick={() => setShowMobileNav(true)}
                  className={clsx(
                    "inline-flex items-center justify-center rounded-full border bg-white px-4 py-2 text-sm font-semibold transition lg:hidden",
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
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                  isDiscipuladoConsole ? "bg-sky-100 text-sky-900" : "bg-brand-100 text-brand-900"
                )}
              >
                {userEmail ? `Conectado: ${userEmail}` : "Sessão ativa"}
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
                    "rounded-full border bg-white px-4 py-2 text-sm font-semibold transition",
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
                  "rounded-full border bg-white px-4 py-2 text-sm font-semibold transition",
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
              "absolute left-0 top-0 h-full w-72 text-white shadow-xl",
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
                    {section.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setShowMobileNav(false)}
                            className={clsx(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:text-white",
                              isDiscipuladoConsole ? "hover:bg-sky-800/80" : "hover:bg-brand-700/80",
                              current === item.href
                                ? isDiscipuladoConsole
                                  ? "bg-sky-700 text-white shadow-sm"
                                  : "bg-brand-700 text-white shadow-sm"
                                : isDiscipuladoConsole
                                  ? "text-slate-200/90"
                                  : "text-brand-100/90"
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
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
