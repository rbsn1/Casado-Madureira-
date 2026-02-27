import { TurmaOption } from "@/lib/chamada";

type ModuleOption = {
  id: string;
  title: string;
};

type AulaHeaderFormProps = {
  turmas: TurmaOption[];
  turmaId: string;
  date: string;
  tema: string;
  moduloId: string;
  moduleOptions: ModuleOption[];
  opening: boolean;
  onTurmaChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTemaChange: (value: string) => void;
  onModuloChange: (value: string) => void;
  onOpen: () => void;
};

function formatTurnoLabel(turno: TurmaOption["turno"]) {
  if (turno === "MANHA") return "Manhã";
  if (turno === "TARDE") return "Tarde";
  if (turno === "NOITE") return "Noite";
  return "Não informado";
}

export function AulaHeaderForm(props: AulaHeaderFormProps) {
  const {
    turmas,
    turmaId,
    date,
    tema,
    moduloId,
    moduleOptions,
    opening,
    onTurmaChange,
    onDateChange,
    onTemaChange,
    onModuloChange,
    onOpen
  } = props;

  return (
    <section className="discipulado-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Chamada</h3>
          <p className="mt-1 text-xs text-slate-600">Abra a chamada por turma e data da aula.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Turma</span>
          <select
            value={turmaId}
            onChange={(event) => onTurmaChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="">Selecione</option>
            {turmas.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome} • {formatTurnoLabel(turma.turno)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Data</span>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Tema da aula (opcional)</span>
          <input
            type="text"
            value={tema}
            onChange={(event) => onTemaChange(event.target.value)}
            placeholder="Ex: Fundamentos da fé"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Módulo (opcional)</span>
          <select
            value={moduloId}
            onChange={(event) => onModuloChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="">Não informado</option>
            {moduleOptions.map((moduleOption) => (
              <option key={moduleOption.id} value={moduleOption.id}>
                {moduleOption.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onOpen}
          disabled={opening || !turmaId || !date}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {opening ? "Abrindo..." : "Abrir chamada"}
        </button>
      </div>
    </section>
  );
}
