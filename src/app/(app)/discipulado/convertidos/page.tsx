"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type CaseSummaryItem = {
  case_id: string;
  member_id: string;
  member_name: string;
  member_phone: string | null;
  status: "em_discipulado" | "concluido" | "pausado";
  notes: string | null;
  updated_at: string;
  done_modules: number;
  total_modules: number;
};

function statusLabel(status: CaseSummaryItem["status"]) {
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

export default function DiscipuladoConvertidosPage() {
  const [cases, setCases] = useState<CaseSummaryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [canCreateNovoConvertido, setCanCreateNovoConvertido] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabaseClient) {
        if (active) setStatusMessage("Supabase não configurado.");
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;
      const allowed =
        scope.isAdminMaster ||
        scope.roles.includes("ADMIN_MASTER") ||
        scope.roles.includes("SUPER_ADMIN") ||
        scope.roles.includes("DISCIPULADOR");
      setHasAccess(allowed);
      setCanCreateNovoConvertido(scope.roles.includes("CADASTRADOR"));
      if (!allowed) return;

      const { data: caseSummaries, error: listError } = await supabaseClient.rpc(
        "list_discipleship_cases_summary",
        {
          status_filter: null,
          target_congregation_id: null,
          rows_limit: 500
        }
      );
      if (!active) return;
      if (listError) {
        setStatusMessage(listError.message);
        return;
      }
      setCases((caseSummaries ?? []) as CaseSummaryItem[]);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const filteredCases = useMemo(() => {
    if (statusFilter === "todos") return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [cases, statusFilter]);

  if (!hasAccess) {
    return (
      <div className="discipulado-panel p-6 text-sm text-slate-700">
        Acesso restrito ao perfil de discipulador e administradores.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-xl font-semibold text-sky-950">Convertidos em acompanhamento</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="em_discipulado">Em discipulado</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
          </select>
          {canCreateNovoConvertido ? (
            <Link
              href="/discipulado/convertidos/novo"
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Novo convertido
            </Link>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!filteredCases.length ? (
          <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum caso encontrado.</div>
        ) : null}
        {filteredCases.map((item) => {
          const percent = item.total_modules ? Math.round((item.done_modules / item.total_modules) * 100) : 0;
          return (
            <Link
              key={item.case_id}
              href={`/discipulado/convertidos/${item.case_id}`}
              className="discipulado-panel block space-y-3 p-4 transition hover:border-sky-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.member_name || "Membro"}</p>
                  <p className="text-xs text-slate-600">{item.member_phone ?? "-"}</p>
                </div>
                <StatusBadge value={statusLabel(item.status)} />
              </div>
              <div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Progresso: {item.done_modules}/{item.total_modules} ({percent}%)
                </p>
              </div>
              <p className="text-xs text-slate-600">{item.notes || "Sem observações gerais."}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
