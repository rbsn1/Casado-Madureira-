type Stage = {
  label: string;
  value: number;
};

export function FunnelChart({ stages }: { stages: Stage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-900">Funil de Integração</h3>
        <span className="pill bg-emerald-100 text-emerald-900">Hoje/Semana/Mês</span>
      </div>
      <div className="mt-4 space-y-3">
        {stages.map((stage, idx) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>{idx + 1}. {stage.label}</span>
              <span>{stage.value}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-400"
                style={{ width: `${(stage.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
