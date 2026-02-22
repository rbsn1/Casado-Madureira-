import Link from "next/link";
import { RiskNowItem } from "./types";

function severityBadge(severity: RiskNowItem["severity"]) {
  if (severity === "high") return "bg-rose-100 text-rose-800";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function RiskNowPanel({ items }: { items: RiskNowItem[] }) {
  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Risco agora">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-900">Risco agora</h3>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">Prioridades</span>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-600">{item.subtitle}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityBadge(item.severity)}`}>{item.count}</span>
            </div>
            <div className="mt-2">
              <Link href={item.href} className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline">
                {item.cta}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
