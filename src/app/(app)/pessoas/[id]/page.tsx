"use client";

import Link from "next/link";
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
      setStatusMessage("Nao foi possivel carregar a pessoa.");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Perfil da Pessoa</p>
          <h2 className="text-xl font-semibold text-emerald-900">
            {pessoa?.nome_completo ?? "Pessoa"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/discipulado/convertidos"
            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
          >
            Operar no Discipulado
          </Link>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            CCM: somente visualizacao
          </span>
        </div>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Fluxo atualizado: marcar integrado, registrar batismo e vincular departamento agora sao operacoes do
        modulo Discipulado.
      </p>

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
              <dt className="text-xs text-slate-500">Status integracao</dt>
              <dd className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <StatusBadge value={integracao?.status ?? "PENDENTE"} />
                <span className="text-xs text-slate-600">
                  Responsavel: {integracao?.responsavel_id ?? "A definir"}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="card-muted card p-3">
              <p className="text-xs font-semibold text-emerald-900">Integracao</p>
              <p className="text-sm text-slate-700">Responsavel: {integracao?.responsavel_id ?? "A definir"}</p>
              <p className="text-xs text-slate-500">
                Ultima interacao: {integracao?.ultima_interacao ? formatDateBR(integracao.ultima_interacao) : "-"}
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
                      .map((item) => `${deptoMap.get(item.departamento_id) ?? "Depto"} (${item.funcao ?? "voluntario"})`)
                      .join(" • ")
                  : "Nenhum vinculo"}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-900">Timeline</h3>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              Somente leitura
            </span>
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
