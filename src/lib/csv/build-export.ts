import { centsToEuroString } from "@/lib/money";
import type { TransactionWithCategory } from "@/lib/types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Bar",
  bank: "Überweisung",
  other: "Sonstige",
};

const HEADER = [
  "Nr.",
  "Datum",
  "Kategorie",
  "Zahlungsart",
  "Zahlungsempfänger/-in",
  "Verwendungszweck",
  "Einnahme (EUR)",
  "Ausgabe (EUR)",
  "Beleg",
];

function csvEscape(value: string): string {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTransactionsCsv(transactions: TransactionWithCategory[]): string {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime(),
  );

  const rows = sorted.map((t, i) => {
    const isIncome = t.category.type === "income";
    // Original-Dateiname bevorzugen (seit Migration 0002), sonst Storage-Name
    const belegName = t.receipt_path
      ? (t.receipt_filename ?? t.receipt_path.split("/").pop() ?? "")
      : "";

    return [
      String(t.voucher_no ?? i + 1),
      new Date(t.occurred_on).toLocaleDateString("de-DE"),
      t.category.name,
      PAYMENT_LABELS[t.payment_method] ?? t.payment_method,
      t.payee ?? "",
      t.description ?? "",
      isIncome ? centsToEuroString(t.amount_cents) : "",
      !isIncome ? centsToEuroString(t.amount_cents) : "",
      belegName,
    ].map(csvEscape);
  });

  const lines = [HEADER.map(csvEscape), ...rows].map((r) => r.join(";"));
  // BOM, damit Excel unter Windows UTF-8 (Umlaute) korrekt erkennt.
  return "﻿" + lines.join("\r\n");
}
