import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PdfPreview } from "@/components/pdf-preview";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Transaction } from "@/lib/types";

type ReceiptRow = Pick<
  Transaction,
  "id" | "occurred_on" | "payee" | "description" | "receipt_path"
>;

export default async function ReceiptsPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, occurred_on, payee, description, receipt_path")
    .not("receipt_path", "is", null)
    .order("occurred_on", { ascending: false });

  const withUrls = await Promise.all(
    ((transactions ?? []) as ReceiptRow[]).map(async (t) => {
      const { data } = await supabase.storage
        .from("receipts")
        .createSignedUrl(t.receipt_path as string, 60 * 10);
      return { ...t, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Belege</h1>
        <ButtonLink href="/transactions/new">+ Beleg hinzufügen</ButtonLink>
      </div>

      {withUrls.length === 0 ? (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-10 w-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6M9 8h1M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
              />
            </svg>
          }
          title="Noch keine Belege hochgeladen"
          description="Belege werden zusammen mit einer Buchung erfasst — Foto oder PDF hochladen, Betrag/Datum werden automatisch vorgeschlagen."
          actionHref="/transactions/new"
          actionLabel="Ersten Beleg hinzufügen"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {withUrls.map((t) => (
            <Link
              key={t.id}
              href={`/transactions/${t.id}`}
              className="block overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-card-hover)"
            >
              <div className="flex h-32 items-center justify-center bg-page">
                {t.url && isImagePath(t.receipt_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.url} alt="Beleg" className="h-full w-full object-cover" />
                ) : /\.xml$/i.test(t.receipt_path ?? "") ? (
                  <span className="text-xs font-medium text-ink-muted">E-Rechnung (XML)</span>
                ) : t.url ? (
                  <PdfPreview url={t.url} thumb />
                ) : (
                  <span className="text-xs font-medium text-ink-muted">PDF</span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-ink">
                  {t.description || t.payee || "Beleg"}
                </p>
                <p className="text-xs text-ink-muted">
                  {new Date(t.occurred_on).toLocaleDateString("de-DE")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function isImagePath(path: string | null) {
  if (!path) return false;
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(path);
}
