"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabaseClient } from "@/lib/supabaseClient";

type Department = {
  id: string;
  name: string;
  slug: string;
  type: "simple" | "colegiado" | "umbrella" | "mixed";
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
};

const typeLabels: Record<Department["type"], string> = {
  simple: "Simples",
  colegiado: "Colegiado",
  umbrella: "Guarda-chuva",
  mixed: "Misto"
};

export default function AdminDepartamentosPage() {
  const { user, role, loading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  async function loadDepartments() {
    setStatus("loading");
    setMessage("");
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data, error } = await supabaseClient
        .from("departments")
        .select("id, name, slug, type, parent_id, is_active, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      setDepartments((data ?? []) as Department[]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    if (role === "admin") loadDepartments();
  }, [role]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return departments.filter((dept) => {
      if (!showInactive && !dept.is_active) return false;
      if (term && !dept.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [departments, showInactive, search]);

  const parentMap = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept.name])),
    [departments]
  );

  if (loading) {
    return <div className="card p-6 text-sm text-slate-600">Carregando permissões...</div>;
  }

  if (!user || role !== "admin") {
    return <div className="card p-6 text-sm text-slate-600">Sem permissão.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Administração</p>
          <h2 className="text-xl font-semibold text-emerald-900">Departamentos</h2>
        </div>
        <Link
          href="/admin/departamentos/novo"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Novo departamento
        </Link>
      </div>

      {message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome"
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Mostrar inativos
        </label>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-emerald-900">Lista de departamentos</h3>
          <button
            type="button"
            onClick={loadDepartments}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Atualizar
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "Tipo", "Pai", "Ativo", "Ordem", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-semibold text-slate-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {status === "loading" ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Carregando departamentos...
                  </td>
                </tr>
              ) : null}
              {status !== "loading" && !filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum departamento encontrado.
                  </td>
                </tr>
              ) : null}
              {filtered.map((dept) => (
                <tr key={dept.id}>
                  <td className="px-4 py-3 text-slate-700">{dept.name}</td>
                  <td className="px-4 py-3 text-slate-600">{typeLabels[dept.type]}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {dept.parent_id ? parentMap.get(dept.parent_id) ?? "-" : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{dept.is_active ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3 text-slate-600">{dept.sort_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/departamentos/${dept.id}`}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                      >
                        Gerenciar
                      </Link>
                      <Link
                        href={`/admin/departamentos/${dept.id}?tab=dados`}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
                      >
                        Editar
                      </Link>
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
