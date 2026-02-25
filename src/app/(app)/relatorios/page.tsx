"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { downloadCsv } from "@/lib/csv";
import { isMissingRpcSignature } from "@/lib/dashboard-utils";

type ReportData = {
  headers: string[];
  rows: (string | number | null)[][];
};

function buildRange(period: string, customStart: string, customEnd: string) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date | null = null;
  if (period === "Hoje") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "Semana") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  }
  if (period === "Mês") {
    start = new Date(now);
    start.setDate(now.getDate() - 30);
  }
  if (period === "Personalizado") {
    if (!customStart || !customEnd) return { start: null, end: null };
    return {
      start: new Date(`${customStart}T00:00:00`),
      end: new Date(`${customEnd}T23:59:59.999`)
    };
  }
  return { start, end };
}

export default function RelatoriosPage() {
  const currentYear = new Date().getFullYear();
  const [reportType, setReportType] = useState("Integração & Batismo");
  const [period, setPeriod] = useState("Mês");
  const [year, setYear] = useState(currentYear);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);

  async function handleGenerate() {
    if (!supabaseClient) {
      setStatusMessage("Supabase não configurado.");
      return;
    }
    setStatusMessage("");
    const { start, end } = buildRange(period, customStart, customEnd);

    if (period === "Personalizado" && (!start || !end)) {
      setStatusMessage("Selecione início e fim para o período personalizado.");
      return;
    }

    const applyRange = (query: any, field: string) => {
      if (start) query = query.gte(field, start.toISOString());
      if (end) query = query.lte(field, end.toISOString());
      return query;
    };

    if (reportType === "Cadastros (lista)") {
      let query = supabaseClient
        .from("pessoas")
        .select("nome_completo, telefone_whatsapp, origem, created_at")
        .eq("cadastro_origem", "ccm")
        .order("created_at", { ascending: false });
      query = applyRange(query, "created_at");
      const { data, error } = await query;
      if (error) {
        setStatusMessage(error.message);
        return;
      }
      const rows = (data ?? []).map((row) => [
        row.nome_completo,
        row.telefone_whatsapp,
        row.origem,
        row.created_at
      ]);
      setReportData({
        headers: ["nome", "telefone", "origem", "criado_em"],
        rows
      });
      return;
    }

    if (reportType === "Voluntariado por departamento") {
      const [departamentosResult, pessoaDeptoResult] = await Promise.all([
        supabaseClient.from("departamentos").select("id, nome"),
        supabaseClient.from("pessoa_departamento").select("departamento_id, pessoa_id")
      ]);
      if (departamentosResult.error || pessoaDeptoResult.error) {
        setStatusMessage("Não foi possível gerar o relatório.");
        return;
      }
      const counts = (pessoaDeptoResult.data ?? []).reduce<Record<string, number>>((acc, item) => {
        acc[item.departamento_id] = (acc[item.departamento_id] ?? 0) + 1;
        return acc;
      }, {});
      const rows = (departamentosResult.data ?? []).map((dept) => [dept.nome, counts[dept.id] ?? 0]);
      setReportData({
        headers: ["departamento", "voluntarios"],
        rows
      });
      return;
    }

    if (reportType === "Consolidado anual") {
      const casadosParams = {
        start_ts: null,
        end_ts: null,
        year
      };
      const casadosPrimary = await supabaseClient.rpc("get_casados_dashboard", {
        ...casadosParams,
        target_congregation_id: null
      });
      const casadosResult =
        casadosPrimary.error && isMissingRpcSignature(casadosPrimary.error.message, "get_casados_dashboard")
          ? await supabaseClient.rpc("get_casados_dashboard", casadosParams)
          : casadosPrimary;

      const [batismosResult] = await Promise.all([
        supabaseClient.from("batismos").select("data").gte("data", `${year}-01-01`).lte("data", `${year}-12-31`)
      ]);

      if (casadosResult.error || batismosResult.error) {
        setStatusMessage("Não foi possível gerar o consolidado.");
        return;
      }

      const monthly = Array.from({ length: 12 }, () => ({ cadastros: 0, batismos: 0 }));
      const monthlyFromDashboard: Array<{ month: number; count: number }> = Array.isArray(casadosResult.data?.cadastros_mensais)
        ? (casadosResult.data.cadastros_mensais as Array<{ month: number; count: number }>)
        : [];

      monthlyFromDashboard.forEach((item) => {
        const monthIndex = Number(item.month) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthly[monthIndex].cadastros = Number(item.count ?? 0);
        }
      });

      (batismosResult.data ?? []).forEach((item) => {
        const month = new Date(item.data).getMonth();
        monthly[month].batismos += 1;
      });
      const rows = monthly.map((item, index) => [
        `${index + 1}`.padStart(2, "0"),
        item.cadastros,
        item.batismos
      ]);
      setReportData({
        headers: ["mes", "cadastros", "batismos"],
        rows
      });
      return;
    }

    if (reportType === "Integração & Batismo") {
      let pessoasQuery = supabaseClient
          .from("pessoas")
          .select("id, nome_completo, telefone_whatsapp, origem, created_at")
          .eq("cadastro_origem", "ccm")
          .order("created_at", { ascending: false });
      pessoasQuery = applyRange(pessoasQuery, "created_at");

      const [pessoasResult, integracaoResult, batismosResult] = await Promise.all([
        pessoasQuery,
        supabaseClient.from("integracao_novos_convertidos").select("pessoa_id, status, responsavel_id"),
        supabaseClient.from("batismos").select("pessoa_id, data")
      ]);
      if (pessoasResult.error || integracaoResult.error || batismosResult.error) {
        setStatusMessage("Não foi possível gerar o relatório.");
        return;
      }
      const integracaoMap = new Map(
        (integracaoResult.data ?? []).map((item) => [item.pessoa_id, item])
      );
      const batismoMap = new Map(
        (batismosResult.data ?? []).map((item) => [item.pessoa_id, item])
      );
      const rows = (pessoasResult.data ?? []).map((pessoa) => {
        const integracao = integracaoMap.get(pessoa.id);
        const batismo = batismoMap.get(pessoa.id);
        return [
          pessoa.nome_completo,
          pessoa.telefone_whatsapp,
          pessoa.origem,
          integracao?.status ?? "PENDENTE",
          integracao?.responsavel_id ?? "",
          batismo?.data ?? ""
        ];
      });
      setReportData({
        headers: ["nome", "telefone", "origem", "status_integracao", "responsavel_id", "batismo"],
        rows
      });
    }
  }

  function handleExportCsv() {
    if (!reportData) {
      setStatusMessage("Gere o relatório antes de exportar.");
      return;
    }
    downloadCsv("relatorio.csv", reportData.headers, reportData.rows);
  }

  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Relatórios e Exportações</p>
          <h2 className="text-xl font-semibold text-emerald-900">Relatórios</h2>
        </div>
        <div className="pill bg-emerald-100 text-emerald-900">
          Consolidado anual somente ao gerar relatório
        </div>
      </div>

      <div className="card p-5">
        <form className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Tipo de relatório</span>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option>Integração & Batismo</option>
              <option>Voluntariado por departamento</option>
              <option>Cadastros (lista)</option>
              <option>Consolidado anual</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Período</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option>Hoje</option>
              <option>Semana</option>
              <option>Mês</option>
              <option>Personalizado</option>
            </select>
          </label>
          {period === "Personalizado" ? (
            <>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Início</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">Fim</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Ano (para consolidado anual)</span>
            <input
              type="number"
              min={2020}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Formato</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-slate-700">
                <input type="checkbox" defaultChecked /> PDF
              </label>
              <label className="flex items-center gap-1 text-slate-700">
                <input type="checkbox" defaultChecked /> Excel/CSV
              </label>
            </div>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Gerar Relatório
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Exportar Excel/CSV
            </button>
          </div>
        </form>
        {statusMessage ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {statusMessage}
          </p>
        ) : null}
        {reportData ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
            Relatório pronto com {reportData.rows.length} linhas.
          </div>
        ) : null}
      </div>
    </div>
  );
}
