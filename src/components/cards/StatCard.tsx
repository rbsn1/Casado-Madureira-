type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
};

const toneStyles = {
  brand: {
    label: "text-brand-900",
    accent: "before:bg-brand-500",
    surface: "bg-brand-50/70 ring-1 ring-brand-100"
  },
  success: {
    label: "text-success-600",
    accent: "before:bg-success-600",
    surface: "bg-success-100/60 ring-1 ring-success-100"
  },
  warning: {
    label: "text-warning-600",
    accent: "before:bg-warning-600",
    surface: "bg-warning-100/60 ring-1 ring-warning-100"
  },
  danger: {
    label: "text-danger-600",
    accent: "before:bg-danger-600",
    surface: "bg-danger-100/60 ring-1 ring-danger-100"
  },
  info: {
    label: "text-info-600",
    accent: "before:bg-info-600",
    surface: "bg-info-100/60 ring-1 ring-info-100"
  }
} as const;

export function StatCard({ label, value, hint, tone = "brand" }: StatCardProps) {
  const styles = toneStyles[tone] ?? toneStyles.brand;
  return (
    <div
      className={`card relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md before:absolute before:left-0 before:top-0 before:h-1.5 before:w-full before:content-[''] ${styles.accent} ${styles.surface}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
