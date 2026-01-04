type Entry = {
  department: string;
  volunteers: number;
};

export function DepartmentBarChart({ entries }: { entries: Entry[] }) {
  const max = Math.max(...entries.map((e) => e.volunteers), 1);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-900">Voluntariado por Departamento</h3>
        <span className="pill bg-emerald-100 text-emerald-900">Departamentos ativos</span>
      </div>
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div key={entry.department}>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>{entry.department}</span>
              <span>{entry.volunteers} servindo</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${(entry.volunteers / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
