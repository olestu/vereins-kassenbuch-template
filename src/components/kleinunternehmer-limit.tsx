import { centsToEuroString } from "@/lib/money";
import { KLEINUNTERNEHMER_LIMITS } from "@/lib/profile";
import { Card } from "@/components/ui/card";

/**
 * §19-UStG-Wächter (nur Business-Profil): zeigt den Netto-Umsatz des laufenden
 * und des Vorjahres gegen die Kleinunternehmer-Grenzen (100.000 € / 25.000 €).
 */
export function KleinunternehmerLimit({
  currentYearRevenueCents,
  previousYearRevenueCents,
  year,
}: {
  currentYearRevenueCents: number;
  previousYearRevenueCents: number;
  year: number;
}) {
  const current = {
    value: currentYearRevenueCents,
    limit: KLEINUNTERNEHMER_LIMITS.currentYear,
  };
  const previous = {
    value: previousYearRevenueCents,
    limit: KLEINUNTERNEHMER_LIMITS.previousYear,
  };

  const pct = (v: { value: number; limit: number }) =>
    Math.min(100, Math.round((v.value / v.limit) * 100));

  const level =
    current.value > current.limit || previous.value > previous.limit
      ? "danger"
      : pct(current) >= 80 || pct(previous) >= 80
        ? "warn"
        : "ok";

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">
          Kleinunternehmerregelung (§19 UStG)
        </h2>
        {level !== "ok" && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              level === "danger"
                ? "bg-expense-bg text-expense-text"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {level === "danger" ? "Grenze überschritten!" : "Grenze im Blick behalten"}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <LimitBar
          label={`Umsatz ${year} (Grenze 100.000 €)`}
          value={current.value}
          limit={current.limit}
        />
        <LimitBar
          label={`Umsatz ${year - 1} (Grenze 25.000 €)`}
          value={previous.value}
          limit={previous.limit}
        />
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Überschreitet der Vorjahresumsatz 25.000 € oder der laufende Umsatz 100.000 €,
        endet die Kleinunternehmerregelung — dann bitte steuerlich beraten lassen.
      </p>
    </Card>
  );
}

function LimitBar({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number;
}) {
  const pct = Math.min(100, (value / limit) * 100);
  const over = value > limit;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-ink-secondary">{label}</span>
        <span className={`font-medium tabular-nums ${over ? "text-expense-text" : "text-ink"}`}>
          {centsToEuroString(value)} € ({Math.round((value / limit) * 100)} %)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-page">
        <div
          className={`h-2 rounded-full ${
            over ? "bg-expense" : pct >= 80 ? "bg-amber-400" : "bg-income"
          }`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}
