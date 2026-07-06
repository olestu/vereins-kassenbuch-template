import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PdfPreview } from "@/components/pdf-preview";
import { RequestReview } from "@/components/request-review";
import { Card } from "@/components/ui/card";
import { centsToEuroString } from "@/lib/money";
import type { Category, ReimbursementRequest } from "@/lib/types";

export default async function ReviewRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: requestRow } = await supabase
    .from("reimbursement_requests")
    .select("*")
    .eq("id", id)
    .single();
  const request = requestRow as ReimbursementRequest | null;
  if (!request) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  let receiptUrl: string | null = null;
  let receiptIsImage = false;
  if (request.receipt_path) {
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(request.receipt_path, 60 * 10);
    receiptUrl = data?.signedUrl ?? null;
    receiptIsImage = /\.(jpe?g|png|webp|gif|heic)$/i.test(request.receipt_path);
  }

  const decided = request.status !== "submitted";

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-ink">
        Antrag von {request.submitter_name}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">Angaben des Mitglieds</h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Name" value={request.submitter_name} />
              {request.submitter_contact && (
                <Row label="Kontakt" value={request.submitter_contact} />
              )}
              <Row label="Betrag" value={`${centsToEuroString(request.amount_cents)} €`} />
              <Row
                label="Kaufdatum"
                value={new Date(request.occurred_on).toLocaleDateString("de-DE")}
              />
              {request.description && <Row label="Beschreibung" value={request.description} />}
              {request.iban && <Row label="IBAN" value={request.iban} mono />}
              <Row
                label="Eingereicht"
                value={new Date(request.created_at).toLocaleDateString("de-DE")}
              />
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="px-4 pt-4 text-sm font-semibold text-ink">Beleg</h2>
            <div className="p-4">
              {receiptUrl ? (
                receiptIsImage ? (
                  <a href={receiptUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptUrl}
                      alt={`Beleg von ${request.submitter_name}`}
                      className="max-h-[70vh] w-full rounded-lg object-contain"
                    />
                  </a>
                ) : /\.xml$/i.test(request.receipt_path ?? "") ? (
                  <a
                    href={receiptUrl}
                    download
                    className="text-sm font-medium text-primary-700 underline"
                  >
                    E-Rechnung (XML) herunterladen
                  </a>
                ) : (
                  <PdfPreview url={receiptUrl} />
                )
              ) : (
                <p className="text-sm text-ink-muted">Kein Beleg vorhanden.</p>
              )}
            </div>
          </Card>
        </div>

        <div>
          {decided ? (
            <Card className="p-6">
              <p className="text-sm text-ink">
                Dieser Antrag wurde bereits{" "}
                <strong>
                  {request.status === "accepted" ? "angenommen" : "abgelehnt"}
                </strong>
                {request.reviewed_at &&
                  ` am ${new Date(request.reviewed_at).toLocaleDateString("de-DE")}`}
                .
              </p>
              {request.review_comment && (
                <p className="mt-2 text-sm text-ink-secondary">
                  Kommentar: {request.review_comment}
                </p>
              )}
            </Card>
          ) : (
            <RequestReview
              request={request}
              categories={(categories ?? []) as Category[]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className={`text-right text-ink ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
