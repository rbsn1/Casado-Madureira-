"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

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
      { href: "/departamentos", label: "Departamentos", roles: ["ADMIN_MASTER","SECRETARIA","LIDER_DEPTO","VOLUNTARIO"] },
      { href: "/relatorios", label: "Relatórios", roles: ["ADMIN_MASTER","SECRETARIA"] },
      { href: "/admin", label: "Admin", roles: ["ADMIN_MASTER"] }
    ]
  },
  {
    title: "Discipulado",
    items: [
      { href: "/discipulado", label: "Dashboard", roles: ["ADMIN_MASTER","DISCIPULADOR"] },
      { href: "/discipulado/convertidos", label: "Convertidos", roles: ["ADMIN_MASTER","DISCIPULADOR"] }
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
  const isCadastradorOnly = roles.length === 1 && roles.includes("CADASTRADOR");

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/acesso-interno");
        return;
      }
      setUserEmail(data.user.email ?? null);
      const { data: rolesData } = await supabaseClient.rpc("get_my_roles");
      const nextRoles = (rolesData ?? []) as string[];
      setRoles(nextRoles);
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
  }, [router]);

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
      {!isCadastradorOnly ? (
        <aside className="hidden lg:block border-r border-brand-900 bg-brand-900 text-white">
          <div className="sticky top-0 flex h-screen flex-col gap-6 p-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 font-bold text-white shadow-inner">
                CM
              </div>
              <div>
                <p className="text-sm text-brand-100/90">SaaS</p>
                <p className="text-lg font-semibold text-white">Casados com a Madureira</p>
              </div>
            </Link>
            <nav className="flex-1 space-y-6">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-100/80">
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items
                      .filter((item) => !item.roles || item.roles.some((role) => roles.includes(role)))
                      .map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={clsx(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-brand-700/80 hover:text-white",
                              current === item.href
                                ? "bg-brand-700 text-white shadow-sm"
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
            <div className="rounded-xl bg-brand-700/40 p-4 shadow-sm ring-1 ring-brand-700/60">
              <p className="text-sm font-semibold text-white">Acesso interno</p>
              <p className="text-xs text-brand-100/90">
                RBAC: ADMIN_MASTER, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO, CADASTRADOR, DISCIPULADOR
              </p>
            </div>
          </div>
        </aside>
      ) : null}
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-text-muted">Casados com a Madureira</p>
              <h1 className="text-2xl font-semibold text-text">
                {isCadastradorOnly ? "Cadastro" : "Painel Interno"}
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isCadastradorOnly ? (
                <button
                  type="button"
                  onClick={() => setShowMobileNav(true)}
                  className="inline-flex items-center justify-center rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition hover:border-brand-700 hover:text-brand-900 lg:hidden"
                >
                  Menu
                </button>
              ) : null}
              <div className="flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-900">
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
                  className="rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition hover:border-brand-700 hover:text-brand-900"
                >
                  Alterar senha
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-brand-100 hover:text-brand-900"
              >
                Sair
              </button>
            </div>
          </header>
          {children}
        </div>
      </main>
      {showMobileNav ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileNav(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-brand-900 text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-brand-800 px-4 py-4">
              <span className="text-sm font-semibold text-brand-100">Menu</span>
              <button
                type="button"
                onClick={() => setShowMobileNav(false)}
                className="rounded-full border border-brand-700/60 px-3 py-1 text-xs text-brand-100 hover:bg-brand-800"
              >
                Fechar
              </button>
            </div>
            <nav className="space-y-6 px-4 py-5">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-100/80">
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.items
                      .filter((item) => !item.roles || item.roles.some((role) => roles.includes(role)))
                      .map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setShowMobileNav(false)}
                            className={clsx(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-brand-700/80 hover:text-white",
                              current === item.href
                                ? "bg-brand-700 text-white shadow-sm"
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
              <h2 className="text-lg font-semibold text-emerald-900">Alterar senha</h2>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Confirmar senha</span>
                <input
                  name="confirm"
                  type="password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
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
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
