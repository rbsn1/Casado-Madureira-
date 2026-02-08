"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";

type CaseItem = {
  id: string;
  member_id: string;
  status: "em_discipulado" | "concluido" | "pausado";
  notes: string | null;
  updated_at: string;
};

type MemberItem = {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
};

type ProgressItem = {
  case_id: string;
  status: "nao_iniciado" | "em_andamento" | "concluido";
};

function statusLabel(status: CaseItem["status"]) {
  if (status === "em_discipulado") return "EM_DISCIPULADO";
  if (status === "concluido") return "CONCLUIDO";
  return "PAUSADO";
}

export default function DiscipuladoConvertidosPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [members, setMembers] = useState<Record<string, MemberItem>>({});
  const [progressStats, setProgressStats] = useState<Record<string, { done: number; total: number }>>({});
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

      const { data: casesData, error: casesError } = await supabaseClient
        .from("discipleship_cases")
        .select("id, member_id, status, notes, updated_at")
        .order("updated_at", { ascending: false });
      if (!active) return;
      if (casesError) {
        setStatusMessage(casesError.message);
        return;
      }

      const caseItems = (casesData ?? []) as CaseItem[];
      setCases(caseItems);

      const memberIds = [...new Set(caseItems.map((item) => item.member_id))];
      if (!memberIds.length) {
        setMembers({});
        setProgressStats({});
        return;
      }

      const [{ data: membersData, error: membersError }, { data: progressData, error: progressError }] =
        await Promise.all([
          supabaseClient
            .from("pessoas")
            .select("id, nome_completo, telefone_whatsapp")
            .in("id", memberIds),
          supabaseClient
            .from("discipleship_progress")
            .select("case_id, status")
            .in("case_id", caseItems.map((item) => item.id))
        ]);

      if (!active) return;
      if (membersError || progressError) {
        setStatusMessage(membersError?.message ?? progressError?.message ?? "Falha ao carregar dados.");
        return;
      }

      const memberMap = ((membersData ?? []) as MemberItem[]).reduce<Record<string, MemberItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
      setMembers(memberMap);

      const nextStats = ((progressData ?? []) as ProgressItem[]).reduce<Record<string, { done: number; total: number }>>(
        (acc, item) => {
          acc[item.case_id] = acc[item.case_id] ?? { done: 0, total: 0 };
          acc[item.case_id].total += 1;
          if (item.status === "concluido") {
            acc[item.case_id].done += 1;
          }
          return acc;
        },
        {}
      );
      setProgressStats(nextStats);
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
          const member = members[item.member_id];
          const progress = progressStats[item.id] ?? { done: 0, total: 0 };
          const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
          return (
            <Link
              key={item.id}
              href={`/discipulado/convertidos/${item.id}`}
              className="discipulado-panel block space-y-3 p-4 transition hover:border-sky-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{member?.nome_completo ?? "Membro"}</p>
                  <p className="text-xs text-slate-600">{member?.telefone_whatsapp ?? "-"}</p>
                </div>
                <StatusBadge value={statusLabel(item.status)} />
              </div>
              <div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Progresso: {progress.done}/{progress.total} ({percent}%)
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
