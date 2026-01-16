"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type UserRole = { role: string; active: boolean };
type UserItem = { id: string; email: string | null; created_at: string; roles: UserRole[] };

const roleOptions = [
  "ADMIN_MASTER",
  "PASTOR",
  "SECRETARIA",
  "NOVOS_CONVERTIDOS",
  "LIDER_DEPTO",
  "VOLUNTARIO"
];

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa.");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro na requisição.");
  return payload;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgStatus, setBgStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [bgMessage, setBgMessage] = useState("");

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

  async function loadBackground() {
    try {
      const data = await apiFetch("/api/settings?key=login_background_url");
      setBgUrl(data.value ?? null);
    } catch {
      setBgUrl(null);
    }
  }

  useEffect(() => {
    loadUsers();
    loadBackground();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatusMessage("");
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "");
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
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

  async function handleUploadBackground(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBgStatus("loading");
    setBgMessage("");
    const formData = new FormData(form);
    const file = formData.get("background");
    const hasFile = file && typeof file === "object" && "name" in file && "size" in file;
    if (!hasFile || (file as File).size === 0) {
      setBgStatus("error");
      setBgMessage("Selecione uma imagem.");
      return;
    }
    if (!(file as File).type.startsWith("image/")) {
      setBgStatus("error");
      setBgMessage("Envie um arquivo de imagem válido.");
      return;
    }
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sem sessão ativa.");
      const response = await fetch("/api/admin/login-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao enviar imagem.");
      setBgUrl(payload.url ?? null);
      setBgStatus("success");
      setBgMessage("Imagem atualizada com sucesso.");
      form.reset();
    } catch (error) {
      setBgStatus("error");
      setBgMessage((error as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Administração</p>
        <h2 className="text-xl font-semibold text-emerald-900">Usuários e Permissões</h2>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-3" onSubmit={handleCreateUser}>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">E-mail</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Senha inicial</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Role</span>
          <select
            name="role"
            defaultValue={roleOptions[0]}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-3">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Criar usuário
          </button>
        </div>
      </form>

      <form className="card space-y-3 p-4" onSubmit={handleUploadBackground}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Papel de parede do login</p>
            <p className="text-xs text-slate-500">Recomendado: imagem horizontal em alta resolução.</p>
          </div>
          {bgUrl ? (
            <a
              href={bgUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-900"
            >
              Ver imagem atual
            </a>
          ) : null}
        </div>
        <input
          name="background"
          type="file"
          accept="image/*"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          disabled={bgStatus === "loading"}
        >
          {bgStatus === "loading" ? "Enviando..." : "Atualizar imagem"}
        </button>
        {bgStatus === "error" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {bgMessage || "Não foi possível atualizar a imagem."}
          </p>
        ) : null}
        {bgStatus === "success" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {bgMessage}
          </p>
        ) : null}
      </form>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-emerald-900">Usuários cadastrados</h3>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Atualizar
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["E-mail", "Criado em", "Roles", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando usuários...
                  </td>
                </tr>
              ) : null}
              {!loading && !users.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : null}
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-slate-700">{user.email ?? "Sem e-mail"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {user.roles.length
                      ? user.roles.map((role) => `${role.role}${role.active ? "" : " (inativo)"}`).join(", ")
                      : "Sem roles"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={roleByUser[user.id] ?? roleOptions[0]}
                        onChange={(event) =>
                          setRoleByUser((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
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
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
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
    </div>
  );
}
