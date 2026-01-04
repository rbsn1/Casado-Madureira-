"use client";

import Link from "next/link";
import { ReactNode } from "react";
import clsx from "clsx";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/cadastros", label: "Cadastros" },
  { href: "/novos-convertidos", label: "Novos Convertidos" },
  { href: "/departamentos", label: "Departamentos" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/admin", label: "Admin" }
];

export function AppShell({ children, activePath }: { children: ReactNode; activePath?: string }) {
  const pathname = usePathname();
  const current = activePath ?? pathname;

  return (
    <div className="app-shell">
      <aside className="hidden lg:block border-r border-slate-100 bg-emerald-50/60">
        <div className="sticky top-0 flex h-screen flex-col gap-6 p-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tea-300 font-bold text-emerald-900 shadow-inner">
              CM
            </div>
            <div>
              <p className="text-sm text-slate-500">SaaS</p>
              <p className="text-lg font-semibold text-emerald-900">Casados com a Madureira</p>
            </div>
          </Link>
          <nav className="flex-1">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-emerald-100 hover:text-emerald-900",
                      current === item.href
                        ? "bg-emerald-200 text-emerald-900 shadow-sm"
                        : "text-slate-700"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
            <p className="text-sm font-semibold text-emerald-900">Acesso interno</p>
            <p className="text-xs text-slate-600">
              RBAC: ADMIN_MASTER, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO
            </p>
          </div>
        </div>
      </aside>
      <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Casados com a Madureira</p>
              <h1 className="text-2xl font-semibold text-emerald-900">Painel Interno</h1>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-900">
              Usuário autenticado
            </div>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
