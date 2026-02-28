import { ChamadaAluno, ChamadaStatus } from "@/lib/chamada";
import { ChamadaAlunoRow } from "./ChamadaAlunoRow";

type ChamadaDraftByAlunoId = Record<
  string,
  {
    status: ChamadaStatus | null;
    observacao: string;
  }
>;

type ChamadaListProps = {
  turmaNome: string;
  date: string;
  tema: string;
  isAulaFechada: boolean;
  supportsFechamento: boolean;
  isCollapsed: boolean;
  alunos: ChamadaAluno[];
  draftByAlunoId: ChamadaDraftByAlunoId;
  saveStateByAlunoId: Record<string, "idle" | "saving" | "saved" | "error">;
  globalSavingState: "saving" | "saved" | "idle";
  onStatusChange: (alunoId: string, value: ChamadaStatus) => void;
  onObservacaoChange: (alunoId: string, value: string) => void;
  onMarkAllPresent: () => void;
  onClear: () => void;
  onExport: () => void;
  onCloseAula: () => void;
  onReopenAula: () => void;
  onToggleCollapsed: () => void;
};

export function ChamadaList(props: ChamadaListProps) {
  const {
    turmaNome,
    date,
    tema,
    isAulaFechada,
    supportsFechamento,
    isCollapsed,
    alunos,
    draftByAlunoId,
    saveStateByAlunoId,
    globalSavingState,
    onStatusChange,
    onObservacaoChange,
    onMarkAllPresent,
    onClear,
    onExport,
    onCloseAula,
    onReopenAula,
    onToggleCollapsed
  } = props;

  const summary = alunos.reduce(
    (acc, aluno) => {
      const status = draftByAlunoId[aluno.alunoId]?.status ?? null;
      if (status === "PRESENTE") acc.presentes += 1;
      if (status === "FALTA") acc.faltas += 1;
      if (status === "JUSTIFICADA") acc.justificadas += 1;
      if (status) acc.marcados += 1;
      return acc;
    },
    { presentes: 0, faltas: 0, justificadas: 0, marcados: 0 }
  );

  return (
    <section className="discipulado-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Lista de chamada</h3>
          <p className="mt-1 text-xs text-slate-600">
            Turma: <strong>{turmaNome}</strong> • Data: <strong>{date}</strong> • Tema: <strong>{tema.trim() || "-"}</strong>
          </p>
        </div>
        <p className="text-xs font-semibold text-slate-600">
          {globalSavingState === "saving" ? "Salvando..." : globalSavingState === "saved" ? "Salvo" : "\u00a0"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMarkAllPresent}
          disabled={isAulaFechada}
          className="min-h-11 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Marcar todos como Presente
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isAulaFechada}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Limpar marcações
        </button>
        <button
          type="button"
          onClick={onExport}
          className="min-h-11 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-50"
        >
          Exportar
        </button>
        {supportsFechamento ? (
          <button
            type="button"
            onClick={isAulaFechada ? onReopenAula : onCloseAula}
            disabled={globalSavingState === "saving"}
            className="min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAulaFechada ? "Editar chamada" : "Fechar chamada"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isCollapsed ? "Expandir chamada" : "Encolher chamada"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        Marcados: <strong>{summary.marcados}</strong>/{alunos.length} • Presentes: <strong>{summary.presentes}</strong> •
        Faltas: <strong>{summary.faltas}</strong> • Justificadas: <strong>{summary.justificadas}</strong>
      </div>

      {!isCollapsed ? (
        <div className="mt-4 grid gap-2">
          {!alunos.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
              Nenhum aluno vinculado à turma selecionada.
            </div>
          ) : (
            alunos.map((aluno) => {
              const draft = draftByAlunoId[aluno.alunoId] ?? { status: null, observacao: "" };
              return (
                <ChamadaAlunoRow
                  key={aluno.alunoId}
                  nome={aluno.nome}
                  status={draft.status}
                  observacao={draft.observacao}
                  saveState={saveStateByAlunoId[aluno.alunoId] ?? "idle"}
                  readOnly={isAulaFechada}
                  onStatusChange={(value) => onStatusChange(aluno.alunoId, value)}
                  onObservacaoChange={(value) => onObservacaoChange(aluno.alunoId, value)}
                />
              );
            })
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
          Chamada encolhida. Clique em <strong>Expandir chamada</strong> para ver os alunos.
        </div>
      )}
    </section>
  );
}
