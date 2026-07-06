import { centsToEuroString } from "@/lib/money";
import { Card } from "@/components/ui/card";

export interface CategoryDatum {
  name: string;
  amountCents: number;
}

export function DashboardCategoryChart({
  title,
  data,
  barColor,
}: {
  title: string;
  data: CategoryDatum[];
  barColor: string;
}) {
  const top = [...data].sort((a, b) => b.amountCents - a.amountCents).slice(0, 8);
  const rest = data.length > 8 ? data.slice(8) : [];
  const restTotal = rest.reduce((sum, d) => sum + d.amountCents, 0);
  const rows = restTotal > 0 ? [...top, { name: "Sonstige", amountCents: restTotal }] : top;
  const max = Math.max(...rows.map((r) => r.amountCents), 1);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">
          Noch keine Daten für diesen Zeitraum.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-ink">{row.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                <div
                  className="animate-grow-bar h-2 rounded-full"
                  style={{
                    width: `${(row.amountCents / max) * 100}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm tabular-nums text-ink-secondary">
                {centsToEuroString(row.amountCents)} €
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
