"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SundayScaleAssignmentsTable } from "@/components/sunday-scale/AssignmentsTable";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  normalizeSundayScaleErrorMessage,
  SUNDAY_SCALE_CULTO_OPTIONS,
  SUNDAY_SCALE_STATUS_OPTIONS,
  SundayScaleAssignmentView,
  SundayScaleItem,
  SundayScalePresenceStatus,
  SundayScaleUserOption,
  sortSundayScaleAssignments
} from "@/lib/sundayServiceScale";

type ScaleAssignmentRow = {
  id: string;
  escala_id: string;
  usuario_id: string;
  status_presenca: SundayScalePresenceStatus;
  respondido_em: string | null;
};

async function apiFetch(path: string) {
  if (supabaseClient == null) throw new Error("Supabase não configurado.");
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa.");

  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro ao consultar a API.");
  return payload;
}

export function SundayScalePortalTrackingCard() {
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<SundayScaleAssignmentView[]>([]);
  const [filterCulto, setFilterCulto] = useState<string>("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<SundayScalePresenceStatus | "">("");

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      if (filterCulto && item.culto !== filterCulto) return false;
      if (filterDate && item.data !== filterDate) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      return true;
    });
  }, [assignments, filterCulto, filterDate, filterStatus]);

  const loadTrackingData = useCallback(async () => {
    if (supabaseClient == null) {
      setAssignments([]);
      return;
    }

    const payload = await apiFetch("/api/escalas-domingo/usuarios");
    const users = (payload.users ?? []) as SundayScaleUserOption[];
    const userLookup = new Map(users.map((item) => [item.id, item]));

    const { data: scalesData, error: scalesError } = await supabaseClient
      .from("escalas_domingo")
      .select("id, culto, data, horario, created_at")
      .order("data", { ascending: true })
      .order("horario", { ascending: true });

    if (scalesError) throw new Error(scalesError.message);

    const scales = (scalesData ?? []) as SundayScaleItem[];
    if (scales.length === 0) {
      setAssignments([]);
      return;
    }

    const scaleById = new Map(scales.map((item) => [item.id, item]));
    const scaleIds = scales.map((item) => item.id);

    const { data: assignmentRows, error: assignmentsError } = await supabaseClient
      .from("escalas_domingo_usuarios")
      .select("id, escala_id, usuario_id, status_presenca, respondido_em")
      .in("escala_id", scaleIds);

    if (assignmentsError) throw new Error(assignmentsError.message);

    const normalized = ((assignmentRows ?? []) as ScaleAssignmentRow[])
      .map<SundayScaleAssignmentView | null>((row) => {
        const scale = scaleById.get(row.escala_id);
        if (!scale) return null;
        const user = userLookup.get(row.usuario_id);
        return {
          id: row.id,
          scaleId: row.escala_id,
          userId: row.usuario_id,
          userName: user?.name ?? ("Usuário " + row.usuario_id.slice(0, 8)),
          userEmail: user?.email ?? null,
          culto: scale.culto,
          data: scale.data,
          horario: scale.horario,
          status: row.status_presenca,
          respondidoEm: row.respondido_em
        };
      })
      .filter((item): item is SundayScaleAssignmentView => Boolean(item));

    setAssignments(sortSundayScaleAssignments(normalized));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void loadTrackingData()
      .catch((error) => {
        if (active) setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadTrackingData]);

  useEffect(() => {
    const client = supabaseClient;
    if (client == null) return;

    const channel = client
      .channel("escalas-domingo-portal-public-tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas_domingo" }, () => {
        void loadTrackingData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas_domingo_usuarios" }, () => {
        void loadTrackingData();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [loadTrackingData]);

  async function handleRemoveAssignment(row: SundayScaleAssignmentView) {
    if (supabaseClient == null) return;
    setActionLoadingId(row.id);
    setStatusMessage("");
    try {
      const { error } = await supabaseClient.from("escalas_domingo_usuarios").delete().eq("id", row.id);
      if (error) throw error;
      await loadTrackingData();
    } catch (error) {
      setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-lg shadow-emerald-100/50 sm:rounded-3xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            Escalas de domingo
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-emerald-950">Usuários vinculados à escala</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600/90">
            Acompanhe os vínculos e o status de presença diretamente pela página principal do portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterCulto}
            onChange={(event) => setFilterCulto(event.target.value)}
            className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-300 focus:outline-none"
          >
            <option value="">Todos os cultos</option>
            {SUNDAY_SCALE_CULTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
            className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-300 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as SundayScalePresenceStatus | "")}
            className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-300 focus:outline-none"
          >
            {SUNDAY_SCALE_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-6 text-sm text-slate-600">
            Carregando vínculos da escala...
          </p>
        ) : (
          <SundayScaleAssignmentsTable
            rows={filteredAssignments}
            emptyMessage="Nenhum usuário vinculado encontrado para os filtros atuais."
            actionLoadingId={actionLoadingId}
            onRemove={handleRemoveAssignment}
          />
        )}
      </div>
    </div>
  );
}
