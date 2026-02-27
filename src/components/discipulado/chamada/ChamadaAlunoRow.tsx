import { ChamadaStatus } from "@/lib/chamada";
import { useState } from "react";

const STATUS_OPTIONS: Array<{ value: ChamadaStatus; label: string }> = [
  { value: "PRESENTE", label: "Presente" },
  { value: "FALTA", label: "Falta" },
  { value: "JUSTIFICADA", label: "Justificada" }
];

type ChamadaAlunoRowProps = {
  nome: string;
  status: ChamadaStatus | null;
  observacao: string;
  saveState: "idle" | "saving" | "saved" | "error";
  onStatusChange: (value: ChamadaStatus) => void;
  onObservacaoChange: (value: string) => void;
};

export function ChamadaAlunoRow(props: ChamadaAlunoRowProps) {
  const { nome, status, observacao, saveState, onStatusChange, onObservacaoChange } = props;
  const [obsOpen, setObsOpen] = useState(Boolean(observacao));

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{nome}</p>
        <button
          type="button"
          onClick={() => setObsOpen((prev) => !prev)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-900"
        >
          {obsOpen ? "Fechar obs" : "Obs"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusChange(option.value)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              status === option.value
                ? "border-sky-700 bg-sky-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {obsOpen ? (
        <div className="mt-3">
          <textarea
            value={observacao}
            onChange={(event) => onObservacaoChange(event.target.value)}
            rows={2}
            placeholder="Observação opcional"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
          />
        </div>
      ) : null}

      <div className="mt-2 text-[11px] font-medium text-slate-500">
        {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : "\u00a0"}
      </div>
    </article>
  );
}
