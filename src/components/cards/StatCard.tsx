type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "emerald" | "sky" | "amber" | "rose" | "violet";
};

const toneStyles = {
  emerald: {
    label: "text-emerald-900",
    accent: "before:bg-emerald-500",
    surface: "bg-emerald-50/70 ring-1 ring-emerald-100"
  },
  sky: {
    label: "text-sky-900",
    accent: "before:bg-sky-500",
    surface: "bg-sky-50/70 ring-1 ring-sky-100"
  },
  amber: {
    label: "text-amber-900",
    accent: "before:bg-amber-500",
    surface: "bg-amber-50/70 ring-1 ring-amber-100"
  },
  rose: {
    label: "text-rose-900",
    accent: "before:bg-rose-500",
    surface: "bg-rose-50/70 ring-1 ring-rose-100"
  },
  violet: {
    label: "text-violet-900",
    accent: "before:bg-violet-500",
    surface: "bg-violet-50/70 ring-1 ring-violet-100"
  }
} as const;

export function StatCard({ label, value, hint, tone = "emerald" }: StatCardProps) {
  const styles = toneStyles[tone] ?? toneStyles.emerald;
  return (
    <div
      className={`card relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md before:absolute before:left-0 before:top-0 before:h-1.5 before:w-full before:content-[''] ${styles.accent} ${styles.surface}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
