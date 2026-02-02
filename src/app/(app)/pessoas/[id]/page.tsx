"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatDateBR } from "@/lib/date";

type Pessoa = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  origem: string | null;
  igreja_origem?: string | null;
  bairro?: string | null;
  data: string | null;
  observacoes: string | null;
};

type Integracao = {
  id: string;
  status: string;
  responsavel_id: string | null;
  ultima_interacao: string | null;
};

type TimelineItem = {
  id: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
};

type BatismoItem = {
  id: string;
  data: string;
  local: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
};

type Depto = {
  id: string;
  nome: string;
};

type PessoaDepto = {
  id: string;
  departamento_id: string;
  funcao: string | null;
  status: string | null;
  desde: string | null;
};

export default function PessoaPerfilPage() {
  const params = useParams();
  const pessoaId = String(params?.id ?? "");
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [batismos, setBatismos] = useState<BatismoItem[]>([]);
  const [departamentos, setDepartamentos] = useState<Depto[]>([]);
  const [pessoaDepto, setPessoaDepto] = useState<PessoaDepto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const loadPessoa = useCallback(async () => {
    if (!supabaseClient || !pessoaId) return;
    setLoading(true);
    setStatusMessage("");
    const [
      pessoaResult,
      integracaoResult,
      timelineResult,
      batismosResult,
      departamentosResult,
      pessoaDeptoResult
    ] = await Promise.all([
      supabaseClient
        .from("pessoas")
        .select("id, nome_completo, telefone_whatsapp, origem, igreja_origem, bairro, data, observacoes")
        .eq("id", pessoaId)
        .single(),
      supabaseClient
        .from("integracao_novos_convertidos")
        .select("id, status, responsavel_id, ultima_interacao")
        .eq("pessoa_id", pessoaId)
        .maybeSingle(),
      supabaseClient
        .from("eventos_timeline")
        .select("id, tipo, descricao, created_at")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("batismos")
        .select("id, data, local, responsavel_id, observacoes")
        .eq("pessoa_id", pessoaId)
        .order("data", { ascending: false }),
      supabaseClient.from("departamentos").select("id, nome").order("nome"),
      supabaseClient
        .from("pessoa_departamento")
        .select("id, departamento_id, funcao, status, desde")
        .eq("pessoa_id", pessoaId)
    ]);

    if (pessoaResult.error) {
      setStatusMessage("Não foi possível carregar a pessoa.");
      setLoading(false);
      return;
    }

    setPessoa(pessoaResult.data ?? null);
    setIntegracao(integracaoResult.data ?? null);
    setTimeline(timelineResult.data ?? []);
    setBatismos(batismosResult.data ?? []);
    setDepartamentos(departamentosResult.data ?? []);
    setPessoaDepto(pessoaDeptoResult.data ?? []);
    setLoading(false);
  }, [pessoaId]);

  useEffect(() => {
    loadPessoa();
  }, [loadPessoa]);

  const deptoMap = useMemo(
    () => new Map(departamentos.map((dept) => [dept.id, dept.nome])),
    [departamentos]
  );

  async function handleStatusUpdate(status: string) {
    if (!supabaseClient || !integracao) return;
    const { error } = await supabaseClient
      .from("integracao_novos_convertidos")
      .update({ status, ultima_interacao: new Date().toISOString() })
      .eq("id", integracao.id);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadPessoa();
  }

  async function handleRegistrarBatismo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !pessoaId) return;
    const formData = new FormData(event.currentTarget);
    const data = String(formData.get("data") ?? "");
    const local = String(formData.get("local") ?? "");
    const observacoes = String(formData.get("observacoes") ?? "");
    if (!data) {
      setStatusMessage("Informe a data do batismo.");
      return;
    }
    const { error } = await supabaseClient.from("batismos").insert({
      pessoa_id: pessoaId,
      data,
      local,
      observacoes
    });
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    await loadPessoa();
  }

  async function handleVincularDepto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !pessoaId) return;
    const formData = new FormData(event.currentTarget);
    const departamento_id = String(formData.get("departamento_id") ?? "");
    const funcao = String(formData.get("funcao") ?? "");
    if (!departamento_id) {
      setStatusMessage("Selecione um departamento.");
      return;
    }
    const { error } = await supabaseClient.from("pessoa_departamento").insert({
      pessoa_id: pessoaId,
      departamento_id,
      funcao,
      status: "ATIVO"
    });
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    await loadPessoa();
  }

  async function handleRegistrarEvento() {
    if (!supabaseClient || !pessoaId) return;
    const tipo = window.prompt("Tipo do evento (CADASTRO, ENCAMINHADO, CONTATO, INTEGRADO, BATISMO, DEPTO_VINCULO)");
    if (!tipo) return;
    const descricao = window.prompt("Descrição do evento");
    if (!descricao) return;
    const { error } = await supabaseClient.from("eventos_timeline").insert({
      pessoa_id: pessoaId,
      tipo,
      descricao
    });
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    await loadPessoa();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Perfil da Pessoa</p>
          <h2 className="text-xl font-semibold text-emerald-900">
            {pessoa?.nome_completo ?? "Pessoa"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleStatusUpdate("INTEGRADO")}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Marcar Integrado
          </button>
          <button
            onClick={() => document.getElementById("batismo-form")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Registrar Batismo
          </button>
          <button
            onClick={() => document.getElementById("depto-form")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Vincular Depto
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-emerald-900">Dados gerais</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Telefone (WhatsApp)</dt>
              <dd className="text-sm font-semibold text-slate-900">{pessoa?.telefone_whatsapp ?? "-"}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Origem</dt>
              <dd className="text-sm font-semibold text-slate-900">{pessoa?.origem ?? "-"}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Igreja de origem</dt>
              <dd className="text-sm font-semibold text-slate-900">{pessoa?.igreja_origem ?? "-"}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Bairro</dt>
              <dd className="text-sm font-semibold text-slate-900">{pessoa?.bairro ?? "-"}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Data</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {pessoa?.data ? formatDateBR(pessoa.data) : "-"}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <dt className="text-xs text-slate-500">Status integração</dt>
              <dd className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <StatusBadge value={integracao?.status ?? "PENDENTE"} />
                <span className="text-xs text-slate-600">
                  Responsável: {integracao?.responsavel_id ?? "A definir"}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Integração</p>
              <p className="text-sm text-slate-700">Responsável: {integracao?.responsavel_id ?? "A definir"}</p>
              <p className="text-xs text-slate-500">
                Última interação:{" "}
                {integracao?.ultima_interacao
                  ? formatDateBR(integracao.ultima_interacao)
                  : "-"}
              </p>
            </div>
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Batismo</p>
              <p className="text-sm text-slate-700">
                {batismos[0]?.data ? formatDateBR(batismos[0].data) : "Sem registro"}
              </p>
              <p className="text-xs text-slate-500">{batismos[0]?.responsavel_id ?? "Secretaria"}</p>
            </div>
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Departamentos</p>
              <p className="text-sm text-slate-700">
                {pessoaDepto.length
                  ? pessoaDepto
                      .map((item) => `${deptoMap.get(item.departamento_id) ?? "Depto"} (${item.funcao ?? "voluntário"})`)
                      .join(" • ")
                  : "Nenhum vínculo"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2" id="batismo-form">
            <form className="card p-4" onSubmit={handleRegistrarBatismo}>
              <h3 className="text-sm font-semibold text-emerald-900">Registrar batismo</h3>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-slate-700">Data</span>
                <input
                  name="data"
                  type="date"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-slate-700">Local</span>
                <input
                  name="local"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-slate-700">Observações</span>
                <textarea
                  name="observacoes"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <button className="mt-3 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700">
                Salvar batismo
              </button>
            </form>

            <form className="card p-4" onSubmit={handleVincularDepto} id="depto-form">
              <h3 className="text-sm font-semibold text-emerald-900">Vincular departamento</h3>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-slate-700">Departamento</span>
                <select
                  name="departamento_id"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecione</option>
                  {departamentos.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-slate-700">Função</span>
                <input
                  name="funcao"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <button className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Vincular
              </button>
            </form>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Timeline</h3>
            <button
              onClick={handleRegistrarEvento}
              className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
            >
              Registrar evento
            </button>
          </div>
          <ol className="mt-3 space-y-3">
            {loading ? <li className="text-sm text-slate-500">Carregando timeline...</li> : null}
            {!loading && !timeline.length ? (
              <li className="text-sm text-slate-500">Nenhum evento registrado.</li>
            ) : null}
            {timeline.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{formatDateBR(event.created_at)}</span>
                  <StatusBadge value={event.tipo} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{event.descricao}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
