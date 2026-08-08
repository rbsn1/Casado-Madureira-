"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatDateBR } from "@/lib/date";

type IntegracaoItem = {
  id: string;
  pessoa_id: string;
  status: string;
  responsavel_id: string | null;
  ultima_interacao: string | null;
  created_at?: string | null;
  nome_completo: string;
  telefone_whatsapp: string | null;
};

function NovosConvertidosContent() {
  const [items, setItems] = useState<IntegracaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const searchParams = useSearchParams();

  async function loadIntegracoes() {
    if (!supabaseClient) {
      setStatusMessage("Supabase não configurado.");
      return;
    }
    setLoading(true);
    setStatusMessage("");

    const [pessoasResult, integracaoResult] = await Promise.all([
      supabaseClient
        .from("pessoas")
        .select("id, nome_completo, telefone_whatsapp")
        .eq("cadastro_origem", "ccm"),
      supabaseClient
        .from("integracao_novos_convertidos")
        .select("id, pessoa_id, status, responsavel_id, ultima_interacao, created_at")
        .order("updated_at", { ascending: false })
    ]);

    if (pessoasResult.error || integracaoResult.error) {
      setStatusMessage("Não foi possível carregar a fila.");
      setLoading(false);
      return;
    }

    const pessoaMap = new Map(
      (pessoasResult.data ?? []).map((pessoa) => [pessoa.id, pessoa])
    );
    const merged = (integracaoResult.data ?? []).map((item) => {
      const pessoa = pessoaMap.get(item.pessoa_id);
      return {
        id: item.id,
        pessoa_id: item.pessoa_id,
        status: item.status,
        responsavel_id: item.responsavel_id,
        ultima_interacao: item.ultima_interacao,
        created_at: item.created_at,
        nome_completo: pessoa?.nome_completo ?? "Sem nome",
        telefone_whatsapp: pessoa?.telefone_whatsapp ?? null
      };
    });
    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadIntegracoes();
  }, []);

  const filteredItems = useMemo(() => {
    const status = searchParams.get("status");
    const statusList = status ? status.split(",") : [];
    const stale = searchParams.get("stale");
    const staleDays = stale ? Number(stale) : null;
    const cutoff = staleDays ? new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000) : null;
    return items.filter((item) => {
      const matchesStatus = statusList.length ? statusList.includes(item.status) : true;
      const referenceDate = item.ultima_interacao ?? item.created_at ?? null;
      const matchesStale = cutoff && referenceDate ? new Date(referenceDate) < cutoff : cutoff ? true : true;
      return matchesStatus && matchesStale;
    });
  }, [items, searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">Integração</p>
          <h2 className="text-xl font-semibold text-brand-900">Fila de Novos Convertidos</h2>
        </div>
        <button
          onClick={loadIntegracoes}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Atualizar fila
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
          {statusMessage}
        </p>
      ) : null}

      <p className="rounded-lg border border-warning-100 bg-warning-100 px-3 py-2 text-xs text-warning-600">
        Esta tela do CCM é somente leitura.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="card p-4 text-sm text-text-muted">Carregando fila...</div>
        ) : null}
        {!loading && !filteredItems.length ? (
          <div className="card p-4 text-sm text-text-muted">Nenhum registro na fila.</div>
        ) : null}
        {filteredItems.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">{item.nome_completo}</p>
                <p className="text-xs text-text-muted">
                  Última atualização:{" "}
                  {item.ultima_interacao ? formatDateBR(item.ultima_interacao) : "-"}
                </p>
              </div>
              <StatusBadge value={item.status} />
            </div>
            <div className="mt-3 space-y-2 text-sm text-text">
              <p>Responsável: {item.responsavel_id ?? "A definir"}</p>
              <p>Telefone: {item.telefone_whatsapp ?? "-"}</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-muted">
                  Somente leitura no CCM
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NovosConvertidosPage() {
  return (
    <Suspense fallback={<div className="card p-4 text-sm text-text-muted">Carregando...</div>}>
      <NovosConvertidosContent />
    </Suspense>
  );
}
