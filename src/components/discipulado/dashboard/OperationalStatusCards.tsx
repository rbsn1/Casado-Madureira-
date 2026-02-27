import { OperationalCardsPeriod, OperationalStatusCardsModel } from "./types";

const PERIOD_OPTIONS: Array<{ value: OperationalCardsPeriod; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" }
];

export function OperationalStatusCards({
  cards,
  period,
  onPeriodChange
}: {
  cards: OperationalStatusCardsModel;
  period: OperationalCardsPeriod;
  onPeriodChange: (value: OperationalCardsPeriod) => void;
}) {
  return (
    <section className="space-y-3" aria-label="Status operacional do discipulado">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-sky-900">Status operacional</h3>
        <div className="-mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <div className="inline-flex min-w-max rounded-lg border border-sky-200 bg-white p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-md px-3 py-2.5 text-xs font-semibold transition ${
                  period === option.value ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-sky-50"
                }`}
                aria-pressed={period === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">VIDAS ACOLHIDAS</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.vidas_acolhidas}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">EM ACOLHIMENTO</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_acolhimento}</p>
        </article>
        <article className="discipulado-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">EM DISCIPULADO</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_discipulado}</p>
        </article>
      </div>
    </section>
  );
}
