import { formatDateBR } from "@/lib/date";
import { SundayScaleAssignmentView, formatScaleTime, sundayScaleCultoLabel } from "@/lib/sundayServiceScale";
import { PresenceStatusBadge } from "@/components/sunday-scale/PresenceStatusBadge";

type AssignmentsTableProps = {
  rows: SundayScaleAssignmentView[];
  emptyMessage: string;
  showNameColumn?: boolean;
  actionLoadingId?: string | null;
  onConfirm?: (row: SundayScaleAssignmentView) => void;
  onDecline?: (row: SundayScaleAssignmentView) => void;
  onRemove?: (row: SundayScaleAssignmentView) => void;
};

export function SundayScaleAssignmentsTable({
  rows,
  emptyMessage,
  showNameColumn = true,
  actionLoadingId,
  onConfirm,
  onDecline,
  onRemove
}: AssignmentsTableProps) {
  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30 px-4 py-6 text-sm text-slate-600">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-emerald-100 text-sm">
          <thead className="bg-brand-50/80 text-left text-xs font-semibold uppercase tracking-wide text-brand-900">
            <tr>
              {showNameColumn ? <th className="px-4 py-3">Nome</th> : null}
              <th className="px-4 py-3">Culto</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Horário</th>
              <th className="px-4 py-3">Status de Presença</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {rows.map((row) => {
              const isLoading = actionLoadingId === row.id;
              const canRespond = Boolean(onConfirm && onDecline && row.status === "pendente");
              const canRemove = Boolean(onRemove);
              return (
                <tr key={row.id} className="align-top text-slate-700 transition hover:bg-brand-50/30">
                  {showNameColumn ? (
                    <td className="px-4 py-4">
                      <div className="font-medium text-emerald-950">{row.userName}</div>
                      {row.userEmail ? <div className="mt-1 text-xs text-slate-500">{row.userEmail}</div> : null}
                    </td>
                  ) : null}
                  <td className="px-4 py-4">{sundayScaleCultoLabel(row.culto)}</td>
                  <td className="px-4 py-4">{formatDateBR(row.data)}</td>
                  <td className="px-4 py-4">{formatScaleTime(row.horario)}</td>
                  <td className="px-4 py-4">
                    <PresenceStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-4">
                    {canRespond ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => onConfirm?.(row)}
                          className="rounded-full bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Confirmar presença
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => onDecline?.(row)}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Não poderei ir
                        </button>
                      </div>
                    ) : canRemove ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => onRemove?.(row)}
                        className="rounded-full border border-brand-100 bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remover da escala
                      </button>
                    ) : row.status === "confirmado" ? (
                      <span className="text-xs font-semibold text-emerald-700">Confirmado</span>
                    ) : row.status === "nao_podera_ir" ? (
                      <span className="text-xs font-semibold text-rose-700">Ausência informada</span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700">Aguardando resposta</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
