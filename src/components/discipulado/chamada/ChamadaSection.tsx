import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChamadaAluno,
  ChamadaStatus,
  exportChamadaCSV,
  getOrCreateAula,
  loadChamadaItens,
  loadTurmaAlunos,
  loadTurmas,
  TurmaOption,
  upsertChamadaItem
} from "@/lib/chamada";
import { supabaseClient } from "@/lib/supabaseClient";
import { AulaHeaderForm } from "./AulaHeaderForm";
import { ChamadaList } from "./ChamadaList";

type ModuleOption = {
  id: string;
  title: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type GlobalSavingState = "idle" | "saving" | "saved";
type DraftByAlunoId = Record<
  string,
  {
    status: ChamadaStatus | null;
    observacao: string;
  }
>;

function toTodayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function debounceMs() {
  return 550;
}

export function ChamadaSection() {
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [openingAula, setOpeningAula] = useState(false);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [moduleOptions, setModuleOptions] = useState<ModuleOption[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [selectedDate, setSelectedDate] = useState(toTodayYmd);
  const [tema, setTema] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [activeAulaId, setActiveAulaId] = useState<string | null>(null);
  const [alunos, setAlunos] = useState<ChamadaAluno[]>([]);
  const [draftByAlunoId, setDraftByAlunoId] = useState<DraftByAlunoId>({});
  const [saveStateByAlunoId, setSaveStateByAlunoId] = useState<Record<string, SaveState>>({});
  const [globalSavingState, setGlobalSavingState] = useState<GlobalSavingState>("idle");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoadingBoot(true);
      setStatusMessage("");

      const [{ data: turmasData, errorMessage: turmasError }, modulesResult, authResult] = await Promise.all([
        loadTurmas(),
        supabaseClient
          ? supabaseClient.from("discipleship_modules").select("id, title").order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabaseClient ? supabaseClient.auth.getUser() : Promise.resolve({ data: { user: null } })
      ]);

      if (!active) return;

      if (turmasError) {
        setStatusMessage(turmasError);
      } else {
        setTurmas(turmasData);
      }

      if (modulesResult?.error) {
        const msg = String(modulesResult.error.message ?? "");
        if (msg) setStatusMessage((prev) => prev || msg);
      } else {
        const normalized = ((modulesResult?.data ?? []) as Array<{ id: string; title: string | null }>).map((item) => ({
          id: String(item.id),
          title: String(item.title ?? "Módulo")
        }));
        setModuleOptions(normalized);
      }

      const userId = String(authResult?.data?.user?.id ?? "");
      setCurrentUserId(userId || null);
      setLoadingBoot(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    const savePulseTimer = savePulseTimerRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
      if (savePulseTimer) clearTimeout(savePulseTimer);
    };
  }, []);

  const selectedTurma = useMemo(
    () => turmas.find((item) => item.id === selectedTurmaId) ?? null,
    [selectedTurmaId, turmas]
  );

  const setSavedPulse = useCallback(() => {
    setGlobalSavingState("saved");
    if (savePulseTimerRef.current) clearTimeout(savePulseTimerRef.current);
    savePulseTimerRef.current = setTimeout(() => {
      setGlobalSavingState("idle");
    }, 1200);
  }, []);

  const persistAlunoDraft = useCallback(
    async (alunoId: string, draft: { status: ChamadaStatus | null; observacao: string }) => {
      if (!activeAulaId) return;
      setSaveStateByAlunoId((prev) => ({ ...prev, [alunoId]: "saving" }));
      setGlobalSavingState("saving");

      const { errorMessage } = await upsertChamadaItem({
        aulaId: activeAulaId,
        alunoId,
        status: draft.status,
        observacao: draft.observacao,
        marcadoPor: currentUserId
      });

      if (errorMessage) {
        setSaveStateByAlunoId((prev) => ({ ...prev, [alunoId]: "error" }));
        setStatusMessage(errorMessage);
        setGlobalSavingState("idle");
        return;
      }

      setSaveStateByAlunoId((prev) => ({ ...prev, [alunoId]: "saved" }));
      setSavedPulse();
      setTimeout(() => {
        setSaveStateByAlunoId((prev) => ({ ...prev, [alunoId]: "idle" }));
      }, 1200);
    },
    [activeAulaId, currentUserId, setSavedPulse]
  );

  const queueAlunoSave = useCallback(
    (alunoId: string, draft: { status: ChamadaStatus | null; observacao: string }) => {
      const currentTimer = timersRef.current[alunoId];
      if (currentTimer) clearTimeout(currentTimer);
      timersRef.current[alunoId] = setTimeout(() => {
        void persistAlunoDraft(alunoId, draft);
      }, debounceMs());
    },
    [persistAlunoDraft]
  );

  const handleOpenAula = useCallback(async () => {
    if (!selectedTurmaId || !selectedDate) {
      setStatusMessage("Selecione turma e data para abrir a chamada.");
      return;
    }
    setOpeningAula(true);
    setStatusMessage("");

    const { data: aula, errorMessage: aulaError } = await getOrCreateAula({
      turmaId: selectedTurmaId,
      date: selectedDate,
      tema,
      moduloId: moduloId || null,
      marcadoPor: currentUserId
    });

    if (aulaError || !aula) {
      setStatusMessage(aulaError || "Não foi possível abrir a chamada.");
      setOpeningAula(false);
      return;
    }

    const [{ data: alunosData, errorMessage: alunosError }, { data: itensData, errorMessage: itensError }] = await Promise.all([
      loadTurmaAlunos(selectedTurmaId),
      loadChamadaItens(aula.id)
    ]);

    if (alunosError || itensError) {
      setStatusMessage(alunosError || itensError || "Falha ao carregar chamada.");
      setOpeningAula(false);
      return;
    }

    const byAlunoId = new Map(
      itensData.map((item) => [
        item.aluno_id,
        {
          status: item.status,
          observacao: item.observacao ?? ""
        }
      ])
    );

    const nextDraft: DraftByAlunoId = {};
    const nextSaveState: Record<string, SaveState> = {};
    for (const aluno of alunosData) {
      const current = byAlunoId.get(aluno.alunoId);
      nextDraft[aluno.alunoId] = {
        status: current?.status ?? null,
        observacao: current?.observacao ?? ""
      };
      nextSaveState[aluno.alunoId] = "idle";
    }

    setActiveAulaId(aula.id);
    setAlunos(alunosData);
    setDraftByAlunoId(nextDraft);
    setSaveStateByAlunoId(nextSaveState);
    setGlobalSavingState("idle");
    setOpeningAula(false);
  }, [currentUserId, moduloId, selectedDate, selectedTurmaId, tema]);

  const handleStatusChange = useCallback(
    (alunoId: string, value: ChamadaStatus) => {
      setDraftByAlunoId((prev) => {
        const nextDraft = {
          ...prev,
          [alunoId]: {
            ...(prev[alunoId] ?? { status: null, observacao: "" }),
            status: value
          }
        };
        queueAlunoSave(alunoId, nextDraft[alunoId]);
        return nextDraft;
      });
    },
    [queueAlunoSave]
  );

  const handleObservacaoChange = useCallback(
    (alunoId: string, value: string) => {
      setDraftByAlunoId((prev) => {
        const nextDraft = {
          ...prev,
          [alunoId]: {
            ...(prev[alunoId] ?? { status: null, observacao: "" }),
            observacao: value
          }
        };
        queueAlunoSave(alunoId, nextDraft[alunoId]);
        return nextDraft;
      });
    },
    [queueAlunoSave]
  );

  const handleMarkAllPresent = useCallback(() => {
    if (!activeAulaId) return;
    setDraftByAlunoId((prev) => {
      const next = { ...prev };
      for (const aluno of alunos) {
        const draft = {
          ...(next[aluno.alunoId] ?? { status: null, observacao: "" }),
          status: "PRESENTE" as ChamadaStatus
        };
        next[aluno.alunoId] = draft;
        queueAlunoSave(aluno.alunoId, draft);
      }
      return next;
    });
  }, [activeAulaId, alunos, queueAlunoSave]);

  const handleClear = useCallback(() => {
    if (!activeAulaId) return;
    setDraftByAlunoId((prev) => {
      const next = { ...prev };
      for (const aluno of alunos) {
        const draft = {
          ...(next[aluno.alunoId] ?? { status: null, observacao: "" }),
          status: null,
          observacao: ""
        };
        next[aluno.alunoId] = draft;
        queueAlunoSave(aluno.alunoId, draft);
      }
      return next;
    });
  }, [activeAulaId, alunos, queueAlunoSave]);

  const handleExport = useCallback(() => {
    if (!selectedTurma || !activeAulaId) {
      setStatusMessage("Abra uma chamada antes de exportar.");
      return;
    }

    exportChamadaCSV({
      turmaNome: selectedTurma.nome,
      data: selectedDate,
      tema,
      rows: alunos.map((aluno) => {
        const draft = draftByAlunoId[aluno.alunoId] ?? { status: null, observacao: "" };
        return {
          nome: aluno.nome,
          status: draft.status,
          observacao: draft.observacao
        };
      })
    });
  }, [activeAulaId, alunos, draftByAlunoId, selectedDate, selectedTurma, tema]);

  return (
    <section className="space-y-4" aria-label="Chamada">
      {statusMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{statusMessage}</p>
      ) : null}

      <AulaHeaderForm
        turmas={turmas}
        turmaId={selectedTurmaId}
        date={selectedDate}
        tema={tema}
        moduloId={moduloId}
        moduleOptions={moduleOptions}
        opening={openingAula || loadingBoot}
        onTurmaChange={setSelectedTurmaId}
        onDateChange={setSelectedDate}
        onTemaChange={setTema}
        onModuloChange={setModuloId}
        onOpen={() => {
          void handleOpenAula();
        }}
      />

      {activeAulaId ? (
        <ChamadaList
          turmaNome={selectedTurma?.nome ?? "Turma"}
          date={selectedDate}
          tema={tema}
          alunos={alunos}
          draftByAlunoId={draftByAlunoId}
          saveStateByAlunoId={saveStateByAlunoId}
          globalSavingState={globalSavingState}
          onStatusChange={handleStatusChange}
          onObservacaoChange={handleObservacaoChange}
          onMarkAllPresent={handleMarkAllPresent}
          onClear={handleClear}
          onExport={handleExport}
        />
      ) : (
        <div className="discipulado-panel p-4 text-sm text-slate-600">Selecione turma e data para abrir a chamada.</div>
      )}
    </section>
  );
}
