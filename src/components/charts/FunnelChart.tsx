type Stage = {
  label: string;
  value: number;
};

export function FunnelChart({ stages }: { stages: Stage[] }) {
  const max = stages.length ? Math.max(...stages.map((s) => s.value), 1) : 1;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Funil de Integração</h3>
        <span className="pill bg-brand-100 text-brand-900">Hoje/Semana/Mês</span>
      </div>
      <div className="mt-4 space-y-3">
        {stages.map((stage, idx) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-xs font-medium text-text-muted">
              <span>{idx + 1}. {stage.label}</span>
              <span>{stage.value}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-surface">
              <div
                className="h-2 rounded-full bg-brand-400"
                style={{ width: `${(stage.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {!stages.length ? <p className="text-xs text-text-muted">Sem dados no período.</p> : null}
      </div>
    </div>
  );
}
