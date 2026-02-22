import { ByAcolhedorRow } from "./types";

export function ByAcolhedorTable({ rows }: { rows: ByAcolhedorRow[] }) {
  return (
    <section className="discipulado-panel p-4 sm:p-5" aria-label="Distribuição por acolhedor">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-900">Por acolhedor</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Capacidade</span>
      </div>

      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-semibold">Acolhedor</th>
                <th className="pb-2 text-right font-semibold">Total</th>
                <th className="pb-2 text-right font-semibold">Críticos</th>
                <th className="pb-2 text-right font-semibold">Sem contato 7+</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2 text-slate-900">{row.name}</td>
                  <td className="py-2 text-right font-semibold text-slate-800">{row.total}</td>
                  <td className="py-2 text-right font-semibold text-rose-700">{row.criticos}</td>
                  <td className="py-2 text-right font-semibold text-amber-700">{row.semContatoSeteDias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-sm text-slate-500">
          Sem dados no período.
        </p>
      )}
    </section>
  );
}
