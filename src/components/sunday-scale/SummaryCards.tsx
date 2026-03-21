import { StatCard } from "@/components/cards/StatCard";

type SummaryCardsProps = {
  confirmed: number;
  pending: number;
  declined: number;
};

export function SundayScaleSummaryCards({ confirmed, pending, declined }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Confirmados" value={confirmed} hint="Usuários que confirmaram presença" tone="emerald" />
      <StatCard label="Pendentes" value={pending} hint="Aguardando retorno do usuário" tone="amber" />
      <StatCard label="Não poderão ir" value={declined} hint="Usuários indisponíveis para o culto" tone="rose" />
    </div>
  );
}
