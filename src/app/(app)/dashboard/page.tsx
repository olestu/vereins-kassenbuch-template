import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient, getCachedSettings } from "@/lib/supabase/server";
import { DashboardStatTiles } from "@/components/dashboard-stat-tiles";
import { DashboardCategoryChart } from "@/components/dashboard-category-chart";

// Recharts (~120 kB) als eigenes Bundle nachladen — die Seite ist sofort bedienbar,
// das Diagramm erscheint einen Moment später im Platzhalter
const DashboardMonthlyChart = dynamic(
  () =>
    import("@/components/dashboard-monthly-chart").then(
      (m) => m.DashboardMonthlyChart,
    ),
  { loading: () => <div className="skeleton h-80" /> },
);
import { KleinunternehmerLimit } from "@/components/kleinunternehmer-limit";
import { InstallApp } from "@/components/install-app";
import type { DashboardPeriodKey } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import {
  bucketize,
  buildPresets,
  isValidIsoDate,
  periodLabel,
  toIso,
  type Period,
} from "@/lib/periods";
import type { TransactionWithCategory } from "@/lib/types";

/** Zuordnung Einstellungs-Schlüssel → Schnellauswahl-Label aus buildPresets() */
const PERIOD_PRESET_LABEL: Record<DashboardPeriodKey, string | null> = {
  alle: null,
  "30t": "Letzte 30 Tage",
  "90t": "Letzte 90 Tage",
  "12m": "Letzte 12 Monate",
  jahr: String(new Date().getFullYear()),
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ von?: string; bis?: string; alle?: string }>;
}) {
  const { von: vonParam, bis: bisParam, alle: alleParam } = await searchParams;
  const supabase = await createClient();
  const settings = await getCachedSettings();
  const presets = buildPresets();

  // Zeitraum: URL-Parameter > Standard aus den Einstellungen > alle Jahre.
  // ?alle=1 erzwingt "Alle Jahre" auch bei anderem eingestellten Standard.
  let period: Period = {
    von: isValidIsoDate(vonParam) ? vonParam : null,
    bis: isValidIsoDate(bisParam) ? bisParam : null,
  };
  if (!period.von && !period.bis && alleParam !== "1") {
    const defaultLabel = PERIOD_PRESET_LABEL[settings.dashboardPeriod];
    const preset = defaultLabel ? presets.find((p) => p.label === defaultLabel) : null;
    if (preset) period = { von: preset.von, bis: preset.bis };
  }
  const allTime = !period.von && !period.bis;

  // Schlanke Auswahl (ohne OCR-Text/Beleg-Metadaten) — und alle Abfragen
  // parallel starten (.then() feuert die Requests sofort)
  let query = supabase
    .from("transactions")
    .select("amount_cents, occurred_on, category:categories(name, type)")
    .is("voided_at", null);
  if (period.von) query = query.gte("occurred_on", period.von);
  if (period.bis) query = query.lte("occurred_on", period.bis);
  const transactionsP = query.then(
    (r) => (r.data ?? []) as unknown as TransactionWithCategory[],
  );

  const currentYear = new Date().getFullYear();
  const oldestP = supabase
    .from("transactions")
    .select("occurred_on")
    .order("occurred_on", { ascending: true })
    .limit(1)
    .single()
    .then((r) => r.data);

  // §19-Wächter (Business): Umsatz laufendes + Vorjahr, unabhängig vom gewählten Zeitraum
  const revenueP =
    settings.profile === "business"
      ? supabase
          .from("transactions")
          .select("amount_cents, occurred_on, category:categories!inner(type, is_private)")
          .is("voided_at", null)
          .eq("categories.type", "income")
          .eq("categories.is_private", false)
          .gte("occurred_on", `${currentYear - 1}-01-01`)
          .then((r) => (r.data ?? []) as { amount_cents: number; occurred_on: string }[])
      : Promise.resolve(null);

  const categoryCountP = supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .then((r) => r.count ?? 0);

  const [transactions, oldest, revenueRows, categoryCount] = await Promise.all([
    transactionsP,
    oldestP,
    revenueP,
    categoryCountP,
  ]);

  let limitData: { current: number; previous: number } | null = null;
  if (revenueRows) {
    limitData = {
      current: revenueRows
        .filter((r) => new Date(r.occurred_on).getFullYear() === currentYear)
        .reduce((s, r) => s + r.amount_cents, 0),
      previous: revenueRows
        .filter((r) => new Date(r.occurred_on).getFullYear() === currentYear - 1)
        .reduce((s, r) => s + r.amount_cents, 0),
    };
  }

  const firstYear = oldest ? new Date(oldest.occurred_on).getFullYear() : currentYear;

  const olderYears = Array.from(
    { length: Math.max(0, currentYear - 1 - firstYear) },
    (_, i) => currentYear - 2 - i,
  );

  const incomeCents = transactions
    .filter((t) => t.category.type === "income")
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const expenseCents = transactions
    .filter((t) => t.category.type === "expense")
    .reduce((sum, t) => sum + t.amount_cents, 0);

  const { data: chartData, unit } = bucketize(transactions, period);

  const byCategory = (type: "income" | "expense") => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.category.type !== type) continue;
      totals.set(t.category.name, (totals.get(t.category.name) ?? 0) + t.amount_cents);
    }
    return Array.from(totals, ([name, amountCents]) => ({ name, amountCents }));
  };

  const pill = (active: boolean) =>
    `rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
      active
        ? "border-primary-600 bg-primary-600 text-white"
        : "border-line bg-surface text-ink-secondary hover:border-primary-200 hover:bg-primary-50"
    }`;

  const hrefFor = (von: string | null, bis: string | null) =>
    von && bis ? `/dashboard?von=${von}&bis=${bis}` : "/dashboard?alle=1";

  return (
    <div className="space-y-6">
      {categoryCount === 0 && (
        <div className="rounded-(--radius-card) border border-primary-200 bg-primary-50 p-5">
          <p className="text-sm font-semibold text-ink">Willkommen! 👋</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Wähle zuerst dein Profil (Verein oder Kleinunternehmen) in den
            Einstellungen — beim Speichern legen wir automatisch die passenden
            Buchungs-Kategorien für dich an.
          </p>
          <Link
            href="/einstellungen"
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          >
            Zu den Einstellungen
          </Link>
        </div>
      )}

      <InstallApp variant="banner" />

      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-ink">
          Übersicht — {periodLabel(period, presets)}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={hrefFor(p.von, p.bis)}
              className={pill(period.von === p.von && period.bis === p.bis)}
            >
              {p.label}
            </Link>
          ))}
          {olderYears.map((y) => (
            <Link
              key={y}
              href={hrefFor(`${y}-01-01`, `${y}-12-31`)}
              className={pill(period.von === `${y}-01-01` && period.bis === `${y}-12-31`)}
            >
              {y}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="d-von" className="mb-1 block text-xs font-medium text-ink-secondary">
              Von
            </label>
            <Input
              id="d-von"
              type="date"
              name="von"
              defaultValue={period.von ?? ""}
              max={toIso(new Date())}
              className="w-40"
            />
          </div>
          <div>
            <label htmlFor="d-bis" className="mb-1 block text-xs font-medium text-ink-secondary">
              Bis
            </label>
            <Input
              id="d-bis"
              type="date"
              name="bis"
              defaultValue={period.bis ?? ""}
              className="w-40"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-primary-50"
          >
            Zeitraum anzeigen
          </button>
        </form>
      </div>

      <DashboardStatTiles
        incomeCents={incomeCents}
        expenseCents={expenseCents}
        balanceLabel={allTime ? "Kassenbestand" : "Saldo"}
      />

      {limitData && (
        <KleinunternehmerLimit
          currentYearRevenueCents={limitData.current}
          previousYearRevenueCents={limitData.previous}
          year={new Date().getFullYear()}
        />
      )}

      <DashboardMonthlyChart
        data={chartData}
        title={`Einnahmen & Ausgaben pro ${unit}`}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <DashboardCategoryChart
          title="Ausgaben nach Kategorie"
          data={byCategory("expense")}
          barColor="#2a78d6"
        />
        <DashboardCategoryChart
          title="Einnahmen nach Kategorie"
          data={byCategory("income")}
          barColor="#1baf7a"
        />
      </div>
    </div>
  );
}
