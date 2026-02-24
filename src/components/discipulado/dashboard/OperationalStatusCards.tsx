import { OperationalStatusCardsModel } from "./types";

export function OperationalStatusCards({ cards }: { cards: OperationalStatusCardsModel }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Status operacional do discipulado">
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">EM DISCIPULADO</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_discipulado}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">CONCLUÍDOS</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.concluidos}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">EM ACOLHIMENTO</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_acolhimento}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">VIDAS ACOLHIDAS</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.vidas_acolhidas}</p>
      </article>
    </section>
  );
}
