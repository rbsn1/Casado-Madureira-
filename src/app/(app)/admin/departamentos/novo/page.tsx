"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/slugify";

type Department = {
  id: string;
  name: string;
};

const typeOptions = [
  { value: "simple", label: "Simples" },
  { value: "colegiado", label: "Colegiado" },
  { value: "umbrella", label: "Guarda-chuva" },
  { value: "mixed", label: "Misto" }
];

export default function AdminNovoDepartamentoPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "simple",
    parent_id: "",
    short_description: "",
    long_description: "",
    location: "",
    meeting_info: "",
    is_active: true,
    sort_order: 0
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadParents() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient
        .from("departments")
        .select("id, name")
        .order("name");
      setDepartments((data ?? []) as Department[]);
    }

    if (role === "admin") loadParents();
  }, [role]);

  const slugHint = useMemo(() => slugify(form.name), [form.name]);

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug ? prev.slug : slugify(value)
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        type: form.type,
        parent_id: form.parent_id || null,
        short_description: form.short_description.trim() || null,
        long_description: form.long_description.trim() || null,
        location: form.location.trim() || null,
        meeting_info: form.meeting_info.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0
      };

      const { error } = await supabaseClient.from("departments").insert(payload);
      if (error) throw error;
      router.push("/admin/departamentos");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="card p-6 text-sm text-slate-600">Carregando permissões...</div>;
  }

  if (!user || role !== "admin") {
    return <div className="card p-6 text-sm text-slate-600">Sem permissão.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Administração</p>
        <h2 className="text-xl font-semibold text-emerald-900">Novo departamento</h2>
      </div>

      {message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {message}
        </p>
      ) : null}

      <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-700">Nome</span>
          <input
            value={form.name}
            onChange={(event) => handleNameChange(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Slug</span>
          <input
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
          {slugHint && !form.slug ? (
            <p className="text-[11px] text-slate-500">Sugestão: {slugHint}</p>
          ) : null}
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Tipo</span>
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Departamento pai</span>
          <select
            value={form.parent_id}
            onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            <option value="">Nenhum</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-700">Descrição curta</span>
          <input
            value={form.short_description}
            onChange={(event) => setForm((prev) => ({ ...prev, short_description: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-700">Descrição longa</span>
          <textarea
            value={form.long_description}
            onChange={(event) => setForm((prev) => ({ ...prev, long_description: event.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Local</span>
          <input
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Informações de reunião</span>
          <input
            value={form.meeting_info}
            onChange={(event) => setForm((prev) => ({ ...prev, meeting_info: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Ordem</span>
          <input
            type="number"
            value={form.sort_order}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ativo
        </label>
        <div className="flex items-center gap-2 md:col-span-2">
          <button
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/departamentos")}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
