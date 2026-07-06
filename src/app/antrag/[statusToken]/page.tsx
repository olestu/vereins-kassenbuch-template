import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { centsToEuroString } from "@/lib/money";
import { DEFAULT_TERMS, getTerms } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import type { ReimbursementStatus } from "@/lib/types";

const STATUS_LABEL: Record<ReimbursementStatus, { text: string; classes: string }> = {
  submitted: { text: "Eingereicht — wird geprüft", classes: "bg-primary-50 text-primary-800" },
  accepted: { text: "Angenommen", classes: "bg-income-bg text-income-text" },
  rejected: { text: "Abgelehnt", classes: "bg-expense-bg text-expense-text" },
};

export default async function RequestStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ statusToken: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const { statusToken } = await params;
  const { neu } = await searchParams;
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("reimbursement_requests")
    .select(
      "status, amount_cents, occurred_on, submitter_name, review_comment, created_at, owner_user_id",
    )
    .eq("status_token", statusToken)
    .single();

  const terms = request
    ? getTerms((await getSettings(admin, request.owner_user_id)).profile)
    : DEFAULT_TERMS;

  return (
    <div className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Vereinslogo" width={48} height={51} className="h-12 w-auto" />
          <span className="text-lg font-semibold text-ink">{terms.publicTitle}</span>
        </div>

        {!request ? (
          <div className="rounded-(--radius-card) border border-line bg-surface p-8 text-center shadow-(--shadow-card)">
            <h1 className="mb-2 text-lg font-semibold text-ink">Antrag nicht gefunden</h1>
            <p className="text-sm text-ink-secondary">
              Der Link ist ungültig. Bitte prüfe, ob du ihn vollständig kopiert hast.
            </p>
          </div>
        ) : (
          <div className="rounded-(--radius-card) border border-line bg-surface p-6 shadow-(--shadow-card)">
            {neu === "1" && (
              <div className="mb-4 rounded-lg bg-income-bg px-3 py-2 text-sm font-medium text-income-text">
                Dein Antrag wurde eingereicht! Speichere diesen Link (z.B. als
                Lesezeichen), um den Status später abzurufen.
              </div>
            )}

            <div className="mb-4">
              <span
                className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${STATUS_LABEL[request.status as ReimbursementStatus].classes}`}
              >
                {STATUS_LABEL[request.status as ReimbursementStatus].text}
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-secondary">Eingereicht von</dt>
                <dd className="font-medium text-ink">{request.submitter_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">Betrag</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {centsToEuroString(request.amount_cents)} €
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">Kaufdatum</dt>
                <dd className="text-ink">
                  {new Date(request.occurred_on).toLocaleDateString("de-DE")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">Eingereicht am</dt>
                <dd className="text-ink">
                  {new Date(request.created_at).toLocaleDateString("de-DE")}
                </dd>
              </div>
            </dl>

            {request.status === "rejected" && request.review_comment && (
              <div className="mt-4 rounded-lg bg-page px-3 py-2 text-sm">
                <p className="font-medium text-ink">Kommentar zur Entscheidung:</p>
                <p className="text-ink-secondary">{request.review_comment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
