import Link from "next/link";
import { createClient, getCachedSettings } from "@/lib/supabase/server";
import { centsToEuroString } from "@/lib/money";
import { getTerms } from "@/lib/profile";
import { Card } from "@/components/ui/card";
import { DashboardStatTiles } from "@/components/dashboard-stat-tiles";
import type { TransactionWithCategory } from "@/lib/types";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const supabase = await createClient();

  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;

  // Schlanke Auswahl + alle Abfragen parallel
  const oldestP = supabase
    .from("transactions")
    .select("occurred_on")
    .order("occurred_on", { ascending: true })
    .limit(1)
    .single()
    .then((r) => r.data);
  const transactionsP = supabase
    .from("transactions")
    .select("amount_cents, occurred_on, receipt_path, category:categories(name, type)")
    .is("voided_at", null)
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`)
    .then((r) => (r.data ?? []) as unknown as TransactionWithCategory[]);

  const [settings, oldest, transactions] = await Promise.all([
    getCachedSettings(),
    oldestP,
    transactionsP,
  ]);
  const terms = getTerms(settings.profile);

  const firstYear = oldest ? new Date(oldest.occurred_on).getFullYear() : currentYear;
  const years = Array.from(
    { length: currentYear - firstYear + 1 },
    (_, i) => currentYear - i,
  );

  const sumByCategory = (type: "income" | "expense") => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.category.type !== type) continue;
      totals.set(t.category.name, (totals.get(t.category.name) ?? 0) + t.amount_cents);
    }
    return Array.from(totals, ([name, cents]) => ({ name, cents })).sort(
      (a, b) => b.cents - a.cents,
    );
  };

  const income = sumByCategory("income");
  const expense = sumByCategory("expense");
  const incomeCents = income.reduce((s, r) => s + r.cents, 0);
  const expenseCents = expense.reduce((s, r) => s + r.cents, 0);
  const receiptsCount = transactions.filter((t) => t.receipt_path).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-ink">Steuererklärung</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          Jahresabschluss für das Finanzamt bzw. den Steuerberater: alle Zahlen des
          gewählten Jahres als Einnahmen-Überschuss-Übersicht, dazu der CSV-Export im
          Kassenbuch-Format.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y}
            href={`/steuererklaerung?year=${y}`}
            className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
              y === year
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-line bg-surface text-ink-secondary hover:border-primary-200 hover:bg-primary-50"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <DashboardStatTiles
        incomeCents={incomeCents}
        expenseCents={expenseCents}
        balanceLabel={`Überschuss ${year}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryTable title={`Einnahmen ${year}`} rows={income} totalCents={incomeCents} income />
        <CategoryTable title={`Ausgaben ${year}`} rows={expense} totalCents={expenseCents} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-ink">{terms.reportName} (PDF)</p>
            <p className="mt-1 text-sm text-ink-secondary">{terms.reportDescription}</p>
          </div>
          <a
            href={`/api/report?year=${year}`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          >
            {terms.reportName} {year} (PDF)
          </a>
        </Card>

        <Card className="flex flex-col justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-ink">Kassenbuch (CSV)</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {transactions.length} Buchungen, davon {receiptsCount} mit Beleg — öffnet
              direkt in Excel (Semikolon-getrennt, deutsches Zahlenformat).
            </p>
          </div>
          <a
            href={`/api/export?year=${year}`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-primary-50"
          >
            CSV {year} herunterladen
          </a>
        </Card>

        <Card className="flex flex-col justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-ink">Komplett-Backup (ZIP)</p>
            <p className="mt-1 text-sm text-ink-secondary">
              CSV plus alle {receiptsCount} Belege in einer Datei — dein Jahres-Backup und
              das Komplettpaket für den Steuerberater.
            </p>
          </div>
          <a
            href={`/api/backup?year=${year}`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-primary-50"
          >
            Backup {year} (ZIP)
          </a>
        </Card>
      </div>

      <p className="text-xs text-ink-muted">
        Hinweis: Belege zu den Buchungen findest du in der{" "}
        <Link href="/receipts" className="underline">
          Beleg-Galerie
        </Link>
        . Denk an ein Backup: CSV + Belege einmal jährlich außerhalb der App sichern.
      </p>
    </div>
  );
}

function CategoryTable({
  title,
  rows,
  totalCents,
  income = false,
}: {
  title: string;
  rows: { name: string; cents: number }[];
  totalCents: number;
  income?: boolean;
}) {
  return (
    <Card>
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Keine Buchungen in diesem Jahr.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-2.5 text-ink">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                  {centsToEuroString(r.cents)} €
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line bg-page font-semibold">
              <td className="px-4 py-2.5 text-ink">Summe</td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums ${
                  income ? "text-income-text" : "text-expense-text"
                }`}
              >
                {centsToEuroString(totalCents)} €
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Card>
  );
}
