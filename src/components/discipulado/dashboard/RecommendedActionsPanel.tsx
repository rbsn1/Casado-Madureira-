import Link from "next/link";
import { RecommendedActionItem } from "./types";

export function RecommendedActionsPanel({ items }: { items: RecommendedActionItem[] }) {
  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Ações recomendadas">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-900">Ações recomendadas</h3>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Determinístico</span>
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.subtitle}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">{item.count}</span>
              </div>
              <div className="mt-2">
                <Link href={item.href} className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline">
                  {item.cta}
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            Operação estável no período. Sem ações urgentes neste momento.
          </p>
        )}
      </div>
    </section>
  );
}
