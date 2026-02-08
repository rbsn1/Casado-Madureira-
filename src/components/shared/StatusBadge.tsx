import clsx from "clsx";

const variants: Record<string, string> = {
  PENDENTE: "bg-warning-100 text-warning-600",
  EM_ANDAMENTO: "bg-info-100 text-info-600",
  EM_DISCIPULADO: "bg-info-100 text-info-600",
  PAUSADO: "bg-amber-100 text-amber-700",
  NAO_INICIADO: "bg-slate-100 text-slate-700",
  ENCAMINHADO: "bg-accent-100 text-accent-600",
  CONTATO: "bg-brand-100 text-brand-900",
  CONCLUIDO: "bg-success-100 text-success-600",
  INTEGRADO: "bg-success-100 text-success-600",
  BATIZADO: "bg-accent-100 text-accent-600",
  BATISMO: "bg-accent-100 text-accent-600",
  CADASTRO: "bg-brand-100 text-brand-900",
  ENCAMINHADO_EVENTO: "bg-accent-100 text-accent-600",
  DEPTO_VINCULO: "bg-tea-100 text-tea-600",
  ATIVO: "bg-success-100 text-success-600",
  INATIVO: "bg-surface text-text-muted"
};

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  return (
    <span className={clsx("pill", variants[normalized] ?? "bg-slate-100 text-slate-700")}>
      {value}
    </span>
  );
}
