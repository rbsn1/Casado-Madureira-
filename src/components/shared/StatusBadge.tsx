import clsx from "clsx";

const variants: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-900",
  EM_ANDAMENTO: "bg-blue-100 text-blue-900",
  CONCLUIDO: "bg-emerald-100 text-emerald-900",
  INTEGRADO: "bg-emerald-100 text-emerald-900",
  BATIZADO: "bg-cyan-100 text-cyan-900",
  ATIVO: "bg-emerald-100 text-emerald-900",
  INATIVO: "bg-slate-200 text-slate-700"
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={clsx("pill", variants[value] ?? "bg-slate-100 text-slate-700")}>
      {value}
    </span>
  );
}
