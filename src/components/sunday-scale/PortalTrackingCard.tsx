"use client";

import { useEffect, useMemo, useState } from "react";
import { SundayScaleAssignmentsTable } from "@/components/sunday-scale/AssignmentsTable";
import {
  normalizeSundayScaleErrorMessage,
  SUNDAY_SCALE_CULTO_OPTIONS,
  SUNDAY_SCALE_STATUS_OPTIONS,
  SundayScaleAssignmentView,
  SundayScalePresenceStatus
} from "@/lib/sundayServiceScale";

const PENDING_CONFIRMATION_HREF = "/acesso-interno?next=%2Fminhas-escalas";

async function loadPublicTracking() {
  const response = await fetch("/api/escalas-domingo/public-tracking", {
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Erro ao consultar a escala pública.");
  return (payload.assignments ?? []) as SundayScaleAssignmentView[];
}

export function SundayScalePortalTrackingCard() {
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
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

  useEffect(() => {
    let active = true;
    setLoading(true);

    void loadPublicTracking()
      .then((data) => {
        if (active) setAssignments(data);
      })
      .catch((error) => {
        if (active) setStatusMessage(normalizeSundayScaleErrorMessage((error as Error).message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-lg shadow-emerald-100/50 sm:rounded-3xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            Escalas de domingo
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-emerald-950">Usuários vinculados à escala</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600/90">
            Visualização pública do acompanhamento dos vínculos e do status de presença dos cultos de domingo. Usuários pendentes podem entrar para confirmar a própria escala.
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
            pendingActionHref={PENDING_CONFIRMATION_HREF}
            pendingActionLabel="Entrar para confirmar"
          />
        )}
      </div>
    </div>
  );
}
