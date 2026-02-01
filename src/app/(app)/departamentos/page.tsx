"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";

type DepartamentoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativo: boolean;
};

type PessoaItem = {
  id: string;
  nome_completo: string;
};

type PessoaDepto = {
  id: string;
  pessoa_id: string;
  departamento_id: string;
  funcao: string | null;
  status: string | null;
  desde: string | null;
};

export default function DepartamentosPage() {
  const [departamentos, setDepartamentos] = useState<DepartamentoItem[]>([]);
  const [pessoas, setPessoas] = useState<PessoaItem[]>([]);
  const [pessoaDepto, setPessoaDepto] = useState<PessoaDepto[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartamentoItem | null>(null);

  async function loadData() {
    if (!supabaseClient) {
      setStatusMessage("Supabase não configurado.");
      return;
    }
    setStatusMessage("");
    const [deptResult, pessoasResult, pessoaDeptoResult] = await Promise.all([
      supabaseClient.from("departamentos").select("id, nome, descricao, responsavel_id, ativo").order("nome"),
      supabaseClient.from("pessoas").select("id, nome_completo").order("nome_completo"),
      supabaseClient.from("pessoa_departamento").select("id, pessoa_id, departamento_id, funcao, status, desde")
    ]);
    if (deptResult.error || pessoasResult.error || pessoaDeptoResult.error) {
      setStatusMessage("Não foi possível carregar os departamentos.");
      return;
    }
    setDepartamentos(deptResult.data ?? []);
    setPessoas(pessoasResult.data ?? []);
    setPessoaDepto(pessoaDeptoResult.data ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const pessoaMap = useMemo(() => new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome_completo])), [pessoas]);

  function countMembers(deptId: string) {
    return pessoaDepto.filter((item) => item.departamento_id === deptId && item.status !== "INATIVO").length;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;
    setStatusMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get("nome") ?? ""),
      descricao: String(formData.get("descricao") ?? ""),
      ativo: formData.get("ativo") === "on"
    };
    const { error } = await supabaseClient.from("departamentos").insert(payload);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    setShowCreate(false);
    await loadData();
  }

  async function handleEdit(dept: DepartamentoItem) {
    if (!supabaseClient) return;
    const nome = window.prompt("Nome do departamento", dept.nome);
    if (!nome) return;
    const descricao = window.prompt("Descrição", dept.descricao ?? "") ?? dept.descricao ?? "";
    const { error } = await supabaseClient
      .from("departamentos")
      .update({ nome, descricao })
      .eq("id", dept.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadData();
  }

  async function handleToggle(dept: DepartamentoItem) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
      .from("departamentos")
      .update({ ativo: !dept.ativo })
      .eq("id", dept.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadData();
  }

  async function handleDelete(dept: DepartamentoItem) {
    if (!supabaseClient) return;
    const confirmDelete = window.confirm(`Excluir o departamento "${dept.nome}"?`);
    if (!confirmDelete) return;
    const { error } = await supabaseClient.from("departamentos").delete().eq("id", dept.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadData();
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !selectedDept) return;
    setStatusMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      pessoa_id: String(formData.get("pessoa_id") ?? ""),
      departamento_id: selectedDept.id,
      funcao: String(formData.get("funcao") ?? ""),
      status: "ATIVO"
    };
    const { error } = await supabaseClient.from("pessoa_departamento").insert(payload);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    await loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Voluntariado</p>
          <h2 className="text-xl font-semibold text-emerald-900">Departamentos</h2>
        </div>
        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Novo departamento
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}

      {showCreate ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome do departamento</span>
            <input
              name="nome"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Descrição</span>
            <input
              name="descricao"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Ativo
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {departamentos.map((dept) => (
          <div key={dept.nome} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{dept.nome}</p>
                <p className="text-sm text-slate-600">Responsável: {dept.responsavel_id ?? "A definir"}</p>
              </div>
              <StatusBadge value={dept.ativo ? "ATIVO" : "INATIVO"} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-700">{countMembers(dept.id)} membros</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(dept)}
                  className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => setSelectedDept(dept)}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Gerir membros
                </button>
                <button
                  onClick={() => handleToggle(dept)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
                >
                  {dept.ativo ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => handleDelete(dept)}
                  className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDept ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-900">
                Membros • {selectedDept.nome}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
              >
                Fechar
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleAddMember}>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Pessoa</span>
                <select
                  name="pessoa_id"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecione</option>
                  {pessoas.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome_completo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Função</span>
                <input
                  name="funcao"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                  placeholder="Voluntário, líder, apoio..."
                />
              </label>
              <div className="md:col-span-2 flex items-center gap-2">
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Adicionar membro
                </button>
              </div>
            </form>

            <div className="mt-4 space-y-2">
              {pessoaDepto
                .filter((item) => item.departamento_id === selectedDept.id)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{pessoaMap.get(item.pessoa_id) ?? "Pessoa"}</p>
                      <p className="text-xs text-slate-500">{item.funcao ?? "Sem função"}</p>
                    </div>
                    <StatusBadge value={item.status ?? "ATIVO"} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
