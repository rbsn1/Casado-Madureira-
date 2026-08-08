type Entry = {
  department: string;
  volunteers: number;
};

export function DepartmentBarChart({ entries }: { entries: Entry[] }) {
  const max = entries.length ? Math.max(...entries.map((e) => e.volunteers), 1) : 1;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Voluntariado por Departamento</h3>
        <span className="pill bg-brand-100 text-brand-900">Departamentos ativos</span>
      </div>
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div key={entry.department}>
            <div className="flex items-center justify-between text-xs font-medium text-text-muted">
              <span>{entry.department}</span>
              <span>{entry.volunteers} servindo</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-surface">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${(entry.volunteers / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {!entries.length ? <p className="text-xs text-text-muted">Sem dados no período.</p> : null}
      </div>
    </div>
  );
}
