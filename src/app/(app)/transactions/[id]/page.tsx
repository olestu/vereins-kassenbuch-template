import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/transaction-form";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { PdfPreview } from "@/components/pdf-preview";
import { TypeBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { centsToEuroString } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: transactionRow } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();
  const transaction = transactionRow as
    | (Transaction & { category: Category })
    | null;
  const { data: categories } = await supabase.from("categories").select("*").order("name");

  if (!transaction) notFound();

  let receiptUrl: string | null = null;
  let receiptIsImage = false;
  if (transaction.receipt_path) {
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(transaction.receipt_path, 60 * 10);
    receiptUrl = data?.signedUrl ?? null;
    receiptIsImage = /\.(jpe?g|png|webp|gif|heic)$/i.test(transaction.receipt_path);
  }
  const receiptIsXml = /\.xml$/i.test(transaction.receipt_path ?? "");

  const isIncome = transaction.category.type === "income";
  const voided = transaction.voided_at !== null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink">
            {transaction.voucher_no != null && (
              <span className="mr-2 text-ink-muted">#{transaction.voucher_no}</span>
            )}
            {transaction.description || transaction.payee || transaction.category.name}
          </h1>
          <TypeBadge type={transaction.category.type} />
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-xl font-semibold tabular-nums ${
              voided
                ? "text-ink-muted line-through"
                : isIncome
                  ? "text-income-text"
                  : "text-expense-text"
            }`}
          >
            {isIncome ? "+" : "−"}&nbsp;{centsToEuroString(transaction.amount_cents)}&nbsp;€
          </span>
          {!voided && <DeleteTransactionButton id={transaction.id} />}
        </div>
      </div>

      {voided && (
        <div className="mb-6 rounded-lg bg-page px-4 py-3 text-sm text-ink-secondary">
          Diese Buchung wurde am{" "}
          {new Date(transaction.voided_at!).toLocaleDateString("de-DE")} storniert. Sie
          zählt in keiner Auswertung mehr mit und kann nicht bearbeitet werden; der Beleg
          bleibt zur Nachvollziehbarkeit erhalten.
        </div>
      )}

      <div className={`grid gap-6 ${receiptUrl ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}>
        {receiptUrl && (
          <Card className="self-start overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Beleg</h2>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                In voller Größe öffnen ↗
              </a>
            </div>
            <div className="bg-page p-3">
              {receiptIsImage ? (
                <a href={receiptUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt="Beleg zur Buchung"
                    className="mx-auto max-h-[75vh] w-auto rounded-lg object-contain"
                  />
                </a>
              ) : receiptIsXml ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <p className="text-sm font-medium text-ink">E-Rechnung (XML)</p>
                  <p className="text-sm text-ink-secondary">
                    Strukturierte Rechnungsdatei — keine Bildvorschau möglich.
                  </p>
                  <a
                    href={receiptUrl}
                    download
                    className="inline-flex min-h-10 items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    XML herunterladen
                  </a>
                </div>
              ) : (
                <PdfPreview url={receiptUrl} />
              )}
            </div>
          </Card>
        )}

        <div>
          {voided ? (
            <Card className="p-6">
              <dl className="space-y-2 text-sm">
                <ReadRow label="Datum" value={new Date(transaction.occurred_on).toLocaleDateString("de-DE")} />
                <ReadRow label="Betrag" value={`${centsToEuroString(transaction.amount_cents)} €`} />
                <ReadRow label="Kategorie" value={transaction.category.name} />
                {transaction.payee && <ReadRow label="Empfänger/-in" value={transaction.payee} />}
                {transaction.description && (
                  <ReadRow label="Verwendungszweck" value={transaction.description} />
                )}
              </dl>
            </Card>
          ) : (
            /* Beleg-Link im Formular unterdrücken — der Beleg ist direkt daneben zu sehen */
            <TransactionForm
              categories={(categories ?? []) as Category[]}
              existing={transaction}
              existingReceiptUrl={null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
