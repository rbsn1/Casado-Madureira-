import Link from "next/link";

type Entry = {
  label: string;
  count: number;
};

export function InsightBarChart({
  title,
  badge,
  entries,
  hrefForLabel
}: {
  title: string;
  badge?: string;
  entries: Entry[];
  hrefForLabel?: (label: string) => string;
}) {
  const max = Math.max(...entries.map((e) => e.count), 1);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-900">{title}</h3>
        {badge ? <span className="pill bg-emerald-100 text-emerald-900">{badge}</span> : null}
      </div>
      <div className="mt-4 space-y-3">
        {entries.map((entry) => {
          const href = hrefForLabel?.(entry.label);
          return (
            <div key={entry.label}>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {entry.label}
                  </Link>
                ) : (
                  <span>{entry.label}</span>
                )}
                <span>{entry.count}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${(entry.count / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {!entries.length ? <p className="text-xs text-slate-500">Sem dados no período.</p> : null}
      </div>
    </div>
  );
}
