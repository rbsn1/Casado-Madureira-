"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/adminApi";
import { formatDateBR } from "@/lib/date";

type UserRole = { role: string; active: boolean };
type UserItem = { id: string; email: string | null; created_at: string; roles: UserRole[]; whatsapp?: string | null };

const roleOptions = [
  "ADMIN_MASTER",
  "SUPER_ADMIN",
  "PASTOR",
  "SECRETARIA",
  "NOVOS_CONVERTIDOS",
  "LIDER_DEPTO",
  "VOLUNTARIO",
  "CADASTRADOR"
];

const fieldClass =
  "w-full rounded-xl border border-border px-4 py-3 text-base focus:border-brand-400 focus:outline-none";

export function UsersSection() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});

  async function loadUsers() {
    setLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch("/api/admin/users");
      setUsers(data.users ?? []);
      setRoleByUser((prev) => {
        const next = { ...prev };
        (data.users ?? []).forEach((user: UserItem) => {
          if (!next[user.id]) next[user.id] = roleOptions[0];
        });
        return next;
      });
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatusMessage("");
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const whatsapp = String(formData.get("whatsapp") ?? "");
    const role = String(formData.get("role") ?? "");
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role, whatsapp })
      });
      form.reset();
      await loadUsers();
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  }

  async function handleAddRole(userId: string) {
    setStatusMessage("");
    try {
      await apiFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({ userId, role: roleByUser[userId] ?? roleOptions[0] })
      });
      await loadUsers();
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  }

  return (
    <>
      {/* Formulário criar usuário */}
      <form className="card grid gap-4 p-4 sm:grid-cols-2" onSubmit={handleCreateUser}>
        <label className="space-y-1 text-sm">
          <span className="text-text">E-mail</span>
          <input
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Senha inicial</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">WhatsApp</span>
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            placeholder="(99) 99999-9999"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text">Role</span>
          <select
            name="role"
            defaultValue={roleOptions[0]}
            className={fieldClass}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto"
          >
            Criar usuário
          </button>
        </div>
      </form>

      {statusMessage ? (
        <p className="rounded-xl border border-danger-100 bg-danger-100/60 px-4 py-3 text-sm text-danger-600">
          {statusMessage}
        </p>
      ) : null}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-brand-900">Usuários cadastrados</h3>
          <button
            type="button"
            onClick={loadUsers}
            className="min-h-[44px] rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50"
          >
            Atualizar
          </button>
        </div>

        {/* Mobile: cards */}
        <div className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
              Carregando usuários...
            </p>
          ) : null}
          {!loading && !users.length ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
              Nenhum usuário encontrado.
            </p>
          ) : null}
          {users.map((user) => (
            <article key={user.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{user.email ?? "Sem e-mail"}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {user.whatsapp ?? "Sem WhatsApp"} · {formatDateBR(user.created_at)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {user.roles.length
                  ? user.roles.map((r) => `${r.role}${r.active ? "" : " (inativo)"}`).join(", ")
                  : "Sem roles"}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={roleByUser[user.id] ?? roleOptions[0]}
                  onChange={(event) =>
                    setRoleByUser((prev) => ({ ...prev, [user.id]: event.target.value }))
                  }
                  className="min-h-[44px] flex-1 rounded-xl border border-border px-3 py-2 text-base focus:border-brand-400 focus:outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddRole(user.id)}
                  className="min-h-[44px] rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Atribuir
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface">
              <tr>
                {["E-mail", "WhatsApp", "Criado em", "Roles", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left font-semibold text-text-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">
                    Carregando usuários...
                  </td>
                </tr>
              ) : null}
              {!loading && !users.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : null}
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-brand-50/50">
                  <td className="px-4 py-3 text-text">{user.email ?? "Sem e-mail"}</td>
                  <td className="px-4 py-3 text-text">{user.whatsapp ?? "—"}</td>
                  <td className="px-4 py-3 text-text">{formatDateBR(user.created_at)}</td>
                  <td className="px-4 py-3 text-text">
                    {user.roles.length
                      ? user.roles.map((r) => `${r.role}${r.active ? "" : " (inativo)"}`).join(", ")
                      : "Sem roles"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={roleByUser[user.id] ?? roleOptions[0]}
                        onChange={(event) =>
                          setRoleByUser((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                        className="rounded-lg border border-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddRole(user.id)}
                        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Atribuir role
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
