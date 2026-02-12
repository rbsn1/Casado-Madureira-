"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type DepartamentoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativo: boolean;
  type: "simple" | "colegiado" | "umbrella" | "mixed";
  parent_id: string | null;
};

type DepartamentoPublico = {
  id: string;
  nome: string;
  responsavel: string | null;
  contato: string | null;
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

const typeLabels: Record<DepartamentoItem["type"], string> = {
  simple: "Simples",
  colegiado: "Colegiado",
  umbrella: "Guarda-chuva",
  mixed: "Misto"
};

export default function DepartamentosPage() {
  const [departamentos, setDepartamentos] = useState<DepartamentoItem[]>([]);
  const [pessoas, setPessoas] = useState<PessoaItem[]>([]);
  const [pessoasLoading, setPessoasLoading] = useState(false);
  const [pessoaDepto, setPessoaDepto] = useState<PessoaDepto[]>([]);
  const [deptPublicos, setDeptPublicos] = useState<DepartamentoPublico[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartamentoItem | null>(null);
  const [selectedPublicDept, setSelectedPublicDept] = useState<DepartamentoItem | null>(null);
  const [publicForm, setPublicForm] = useState({
    responsavel: "",
    contato: "",
    ativo: true
  });

  async function loadPessoasForModal() {
    if (!supabaseClient || pessoas.length || pessoasLoading) return;
    setPessoasLoading(true);
    const { data, error } = await supabaseClient.from("pessoas").select("id, nome_completo").order("nome_completo");
    if (error) {
      setStatusMessage((prev) => prev || "Falha ao carregar pessoas para vincular ao departamento.");
      setPessoasLoading(false);
      return;
    }
    setPessoas(data ?? []);
    setPessoasLoading(false);
  }

  async function loadData() {
    if (!supabaseClient) {
      setStatusMessage("Supabase não configurado.");
      return;
    }
    const scope = await getAuthScope();
    const allowed = scope.roles.includes("DISCIPULADOR");
    setHasAccess(allowed);
    if (!allowed) {
      setStatusMessage("Acesso restrito à gestão de departamentos no módulo de Discipulado.");
      setDepartamentos([]);
      setPessoas([]);
      setPessoasLoading(false);
      setPessoaDepto([]);
      setDeptPublicos([]);
      return;
    }
    setStatusMessage("");
    const [deptResult, pessoaDeptoResult, publicDeptResult] = await Promise.all([
      supabaseClient
        .from("departamentos")
        .select("id, nome, descricao, responsavel_id, ativo, type, parent_id")
        .order("nome"),
      supabaseClient.from("pessoa_departamento").select("id, pessoa_id, departamento_id, funcao, status, desde"),
      supabaseClient.from("departamentos_publicos").select("id, nome, responsavel, contato, ativo").order("nome")
    ]);
    if (deptResult.error || pessoaDeptoResult.error || publicDeptResult.error) {
      setStatusMessage("Não foi possível carregar os departamentos.");
      return;
    }
    setDepartamentos(deptResult.data ?? []);
    setPessoaDepto(pessoaDeptoResult.data ?? []);
    setDeptPublicos(publicDeptResult.data ?? []);
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
      ativo: formData.get("ativo") === "on",
      type: String(formData.get("type") ?? "simple"),
      parent_id: String(formData.get("parent_id") ?? "") || null
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

  function handleOpenPublic(dept: DepartamentoItem) {
    const existing = deptPublicos.find((item) => item.nome === dept.nome);
    setSelectedPublicDept(dept);
    setPublicForm({
      responsavel: existing?.responsavel ?? "",
      contato: existing?.contato ?? "",
      ativo: existing?.ativo ?? true
    });
  }

  async function handleSavePublic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !selectedPublicDept) return;
    setStatusMessage("");
    const existing = deptPublicos.find((item) => item.nome === selectedPublicDept.nome);
    if (existing) {
      const { error } = await supabaseClient
        .from("departamentos_publicos")
        .update({
          responsavel: publicForm.responsavel.trim() || null,
          contato: publicForm.contato.trim() || null,
          ativo: publicForm.ativo
        })
        .eq("id", existing.id);
      if (error) {
        setStatusMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabaseClient.from("departamentos_publicos").insert({
        nome: selectedPublicDept.nome,
        responsavel: publicForm.responsavel.trim() || null,
        contato: publicForm.contato.trim() || null,
        ativo: publicForm.ativo
      });
      if (error) {
        setStatusMessage(error.message);
        return;
      }
    }
    setSelectedPublicDept(null);
    await loadData();
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !selectedDept) return;
    setStatusMessage("");
    const formData = new FormData(event.currentTarget);
    const pessoaId = String(formData.get("pessoa_id") ?? "");
    if (!pessoaId) {
      setStatusMessage("Selecione uma pessoa.");
      return;
    }

    const { data: eligible, error: eligibleError } = await supabaseClient.rpc(
      "is_member_department_eligible",
      { target_member_id: pessoaId }
    );
    if (eligibleError) {
      setStatusMessage(eligibleError.message);
      return;
    }
    if (!eligible) {
      setStatusMessage("Para participar de departamentos, conclua o discipulado.");
      return;
    }

    const payload = {
      pessoa_id: pessoaId,
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
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-xl font-semibold text-sky-950">Departamentos</h2>
        </div>
        {hasAccess ? (
          <button
            onClick={() => setShowCreate((prev) => !prev)}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Novo departamento
          </button>
        ) : null}
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
            <span className="text-slate-700">Tipo</span>
            <select
              name="type"
              defaultValue="simple"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Descrição</span>
            <input
              name="descricao"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Departamento pai</span>
            <select
              name="parent_id"
              defaultValue=""
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Nenhum</option>
              {departamentos.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.nome}
                </option>
              ))}
            </select>
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
                <p className="text-xs text-slate-500">
                  Tipo: {typeLabels[dept.type]} • Pai:{" "}
                  {dept.parent_id ? departamentos.find((item) => item.id === dept.parent_id)?.nome ?? "-" : "-"}
                </p>
                <p className="text-sm text-slate-600">Responsável: {dept.responsavel_id ?? "A definir"}</p>
                <p className="text-xs text-slate-500">
                  Contato público:{" "}
                  {deptPublicos.find((item) => item.nome === dept.nome)?.contato ?? "Não informado"}
                </p>
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
                  onClick={() => {
                    setSelectedDept(dept);
                    loadPessoasForModal();
                  }}
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
                  onClick={() => handleOpenPublic(dept)}
                  className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Contato público
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
                  disabled={pessoasLoading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">
                    {pessoasLoading ? "Carregando pessoas..." : "Selecione"}
                  </option>
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

      {selectedPublicDept ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-900">
                Contato público • {selectedPublicDept.nome}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedPublicDept(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
              >
                Fechar
              </button>
            </div>
            <form className="mt-4 grid gap-3" onSubmit={handleSavePublic}>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Responsável</span>
                <input
                  value={publicForm.responsavel}
                  onChange={(event) =>
                    setPublicForm((prev) => ({ ...prev, responsavel: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Contato (WhatsApp ou e-mail)</span>
                <input
                  value={publicForm.contato}
                  onChange={(event) =>
                    setPublicForm((prev) => ({ ...prev, contato: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publicForm.ativo}
                  onChange={(event) =>
                    setPublicForm((prev) => ({ ...prev, ativo: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ativo
              </label>
              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Salvar contato
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
