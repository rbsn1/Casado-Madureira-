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
  alunos: ChamadaAluno[];
  draftByAlunoId: ChamadaDraftByAlunoId;
  saveStateByAlunoId: Record<string, "idle" | "saving" | "saved" | "error">;
  globalSavingState: "saving" | "saved" | "idle";
  onStatusChange: (alunoId: string, value: ChamadaStatus) => void;
  onObservacaoChange: (alunoId: string, value: string) => void;
  onMarkAllPresent: () => void;
  onClear: () => void;
  onExport: () => void;
};

export function ChamadaList(props: ChamadaListProps) {
  const {
    turmaNome,
    date,
    tema,
    alunos,
    draftByAlunoId,
    saveStateByAlunoId,
    globalSavingState,
    onStatusChange,
    onObservacaoChange,
    onMarkAllPresent,
    onClear,
    onExport
  } = props;

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
          className="min-h-11 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Marcar todos como Presente
        </button>
        <button
          type="button"
          onClick={onClear}
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
      </div>

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
                onStatusChange={(value) => onStatusChange(aluno.alunoId, value)}
                onObservacaoChange={(value) => onObservacaoChange(aluno.alunoId, value)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
