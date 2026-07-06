import type { TransactionWithCategory } from "@/lib/types";
import type { MonthlyDatum } from "@/components/dashboard-monthly-chart";

export interface Period {
  von: string | null; // ISO yyyy-mm-dd
  bis: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Schnellauswahl-Zeiträume relativ zu heute */
export function buildPresets(today = new Date()) {
  const year = today.getFullYear();
  const start12m = new Date(year, today.getMonth() - 11, 1);

  return [
    { label: "Alle Jahre", von: null as string | null, bis: null as string | null },
    { label: "Letzte 30 Tage", von: toIso(new Date(today.getTime() - 29 * DAY_MS)), bis: toIso(today) },
    { label: "Letzte 90 Tage", von: toIso(new Date(today.getTime() - 89 * DAY_MS)), bis: toIso(today) },
    { label: "Letzte 12 Monate", von: toIso(start12m), bis: toIso(today) },
    { label: `${year}`, von: `${year}-01-01`, bis: `${year}-12-31` },
    { label: `${year - 1}`, von: `${year - 1}-01-01`, bis: `${year - 1}-12-31` },
  ];
}

export function periodLabel(period: Period, presets: ReturnType<typeof buildPresets>): string {
  const match = presets.find((p) => p.von === period.von && p.bis === period.bis);
  if (match) return match.label;
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE") : "…");
  return `${fmt(period.von)} – ${fmt(period.bis)}`;
}

/**
 * Aggregiert Buchungen für das Diagramm; Auflösung richtet sich nach der Spanne:
 * bis ~16 Wochen → wöchentlich, bis ~26 Monate → monatlich, sonst jährlich.
 * Leere Zwischen-Buckets werden aufgefüllt, damit die Achse durchgehend ist.
 */
export function bucketize(
  transactions: TransactionWithCategory[],
  period: Period,
): { data: MonthlyDatum[]; unit: "Woche" | "Monat" | "Jahr" } {
  if (transactions.length === 0 && (!period.von || !period.bis)) {
    return { data: [], unit: "Jahr" };
  }

  const dates = transactions.map((t) => new Date(t.occurred_on).getTime());
  const from = period.von ? new Date(period.von) : new Date(Math.min(...dates));
  const to = period.bis ? new Date(period.bis) : new Date(Math.max(...dates));
  const spanDays = Math.max(1, (to.getTime() - from.getTime()) / DAY_MS);

  const unit: "Woche" | "Monat" | "Jahr" =
    spanDays <= 112 ? "Woche" : spanDays <= 800 ? "Monat" : "Jahr";

  const keyOf = (d: Date): string => {
    if (unit === "Jahr") return String(d.getFullYear());
    if (unit === "Monat")
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
    // Woche: auf Montag normalisieren
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  // Buckets in Reihenfolge erzeugen (inkl. leerer)
  const keys: string[] = [];
  const cursor = new Date(from);
  if (unit === "Woche") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  if (unit === "Monat") cursor.setDate(1);
  if (unit === "Jahr") {
    cursor.setMonth(0);
    cursor.setDate(1);
  }
  while (cursor <= to) {
    keys.push(keyOf(cursor));
    if (unit === "Woche") cursor.setDate(cursor.getDate() + 7);
    else if (unit === "Monat") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setFullYear(cursor.getFullYear() + 1);
  }

  const buckets = new Map<string, { Einnahmen: number; Ausgaben: number }>(
    keys.map((k) => [k, { Einnahmen: 0, Ausgaben: 0 }]),
  );
  for (const t of transactions) {
    const bucket = buckets.get(keyOf(new Date(t.occurred_on)));
    if (!bucket) continue;
    if (t.category.type === "income") bucket.Einnahmen += t.amount_cents;
    else bucket.Ausgaben += t.amount_cents;
  }

  return {
    data: keys.map((k) => ({ month: k, ...buckets.get(k)! })),
    unit,
  };
}
