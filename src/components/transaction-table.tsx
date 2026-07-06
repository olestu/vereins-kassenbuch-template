import Link from "next/link";
import { centsToEuroString } from "@/lib/money";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { TypeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TransactionWithCategory } from "@/lib/types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Bar",
  bank: "Überweisung",
  other: "Sonstige",
};

export function TransactionTable({
  transactions,
  highlightId = null,
}: {
  transactions: TransactionWithCategory[];
  /** Frisch gespeicherte Buchung kurz hervorheben */
  highlightId?: string | null;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Noch keine Buchungen für diesen Zeitraum"
        description="Lege die erste Buchung an — mit Beleg-Foto werden Betrag und Datum automatisch vorgeschlagen."
        actionHref="/transactions/new"
        actionLabel="+ Neue Buchung"
      />
    );
  }

  return (
    <ul className="divide-y divide-line/60 overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card)">
      {transactions.map((t) => {
        const isIncome = t.category.type === "income";
        const voided = t.voided_at !== null;
        return (
          <li
            key={t.id}
            className={`relative ${voided ? "opacity-55" : ""} ${
              t.id === highlightId ? "animate-row-highlight" : ""
            }`}
          >
            {/* Ganze Zeile klickbar; Stornieren liegt als Geschwister-Element darüber */}
            <Link
              href={`/transactions/${t.id}`}
              className="block px-4 py-3 pr-14 transition-colors hover:bg-primary-50/50 active:bg-primary-50"
            >
              <div className="flex items-center justify-between gap-3 md:grid md:grid-cols-[6.5rem_minmax(0,1.2fr)_minmax(0,2fr)_auto] md:gap-4">
                <span className="hidden whitespace-nowrap text-sm text-ink-secondary md:block">
                  {new Date(t.occurred_on).toLocaleDateString("de-DE")}
                </span>

                <span className="hidden min-w-0 items-center gap-2 md:flex">
                  <span className="truncate text-sm font-medium text-ink">
                    {t.category.name}
                  </span>
                  <TypeBadge type={t.category.type} />
                </span>

                <span className="hidden min-w-0 truncate text-sm text-ink-secondary md:block">
                  {t.description || t.payee || "—"}
                  <span className="text-ink-muted"> · {PAYMENT_LABELS[t.payment_method]}</span>
                </span>

                {/* Mobile: kompakte zweizeilige Darstellung */}
                <span className="min-w-0 md:hidden">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {t.description || t.payee || t.category.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {new Date(t.occurred_on).toLocaleDateString("de-DE")} · {t.category.name}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {voided && (
                    <span className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink-secondary">
                      Storniert
                    </span>
                  )}
                  <span
                    className={`whitespace-nowrap text-right text-sm font-semibold tabular-nums ${
                      voided
                        ? "text-ink-muted line-through"
                        : isIncome
                          ? "text-income-text"
                          : "text-expense-text"
                    }`}
                  >
                    {isIncome ? "+" : "−"}&nbsp;{centsToEuroString(t.amount_cents)}&nbsp;€
                  </span>
                </span>
              </div>
            </Link>

            {!voided && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <DeleteTransactionButton id={t.id} variant="icon" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
