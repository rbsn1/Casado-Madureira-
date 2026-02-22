import { OperationalStatusCardsModel } from "./types";

export function OperationalStatusCards({ cards }: { cards: OperationalStatusCardsModel }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Status operacional do discipulado">
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">EM DISCIPULADO</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.em_discipulado}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">CONCLUÍDOS</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.concluidos}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">PARADOS</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.parados}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">PENDENTES CRÍTICOS</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.pendentes_criticos}</p>
      </article>
      <article className="discipulado-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">PRÓXIMOS A CONCLUIR</p>
        <p className="mt-2 text-3xl font-bold text-sky-950">{cards.proximos_a_concluir}</p>
      </article>
    </section>
  );
}
