"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { DepartmentBarChart } from "@/components/charts/DepartmentBarChart";

type FunnelStage = { label: string; value: number };
type VoluntarioEntry = { department: string; volunteers: number };

type Destaques = {
  contatos_7d: number;
  departamentos_ativos: number;
  batismos_30d: number;
};

type Pendencias = {
  pendente_7d: number;
  pendente_14d: number;
};

export default function NovosConvertidosDashboardPage() {
  const currentYear = new Date().getFullYear();
  const [statusMessage, setStatusMessage] = useState("");
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [voluntariado, setVoluntariado] = useState<VoluntarioEntry[]>([]);
  const [destaques, setDestaques] = useState<Destaques>({
    contatos_7d: 0,
    departamentos_ativos: 0,
    batismos_30d: 0
  });
  const [pendencias, setPendencias] = useState<Pendencias>({
    pendente_7d: 0,
    pendente_14d: 0
  });

  useEffect(() => {
    async function loadDashboard() {
      if (!supabaseClient) {
        setStatusMessage("Supabase não configurado.");
        return;
      }
      setStatusMessage("");
      const { data, error } = await supabaseClient.rpc("get_novos_dashboard", {
        start_ts: null,
        end_ts: null,
        year: currentYear
      });

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      setFunnel((data?.funnel ?? []) as FunnelStage[]);
      setVoluntariado(
        (data?.voluntariado ?? []).map((item: any) => ({
          department: item.label,
          volunteers: item.count
        }))
      );
      setDestaques((prev) => data?.destaques ?? prev);
      setPendencias((prev) => data?.pendencias ?? prev);
    }

    loadDashboard();
  }, [currentYear]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Novos Convertidos</p>
          <h2 className="text-xl font-semibold text-emerald-900">Dashboard</h2>
        </div>
        <button className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-accent-700">
          Registrar batismo rápido
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart stages={funnel} />
        <DepartmentBarChart entries={voluntariado} />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-emerald-900">Destaques operacionais</h3>
            <p className="text-sm text-slate-600">Indicadores dos últimos dias.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="card p-4 border-emerald-100 bg-emerald-50/70">
            <p className="text-xs font-semibold uppercase text-emerald-800">Integração & contatos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{destaques.contatos_7d}</p>
            <p className="text-xs text-slate-500">últimos 7 dias</p>
          </div>
          <div className="card p-4 border-amber-100 bg-amber-50/70">
            <p className="text-xs font-semibold uppercase text-amber-800">Departamentos ativos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{destaques.departamentos_ativos}</p>
            <p className="text-xs text-slate-500">com pessoas servindo</p>
          </div>
          <div className="card p-4 border-sky-100 bg-sky-50/70">
            <p className="text-xs font-semibold uppercase text-sky-800">Batismos marcados</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{destaques.batismos_30d}</p>
            <p className="text-xs text-slate-500">próximos 30 dias</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Pendências</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Link
            href="/novos-convertidos?status=PENDENTE,CONTATO&stale=7"
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-emerald-50"
          >
            <span>Pendentes há +7 dias</span>
            <span className="font-semibold text-emerald-700">{pendencias.pendente_7d}</span>
          </Link>
          <Link
            href="/novos-convertidos?status=PENDENTE,CONTATO&stale=14"
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-emerald-50"
          >
            <span>Pendentes há +14 dias</span>
            <span className="font-semibold text-emerald-700">{pendencias.pendente_14d}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
