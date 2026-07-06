import Link from "next/link";
import { createClient, getCachedSettings } from "@/lib/supabase/server";
import { centsToEuroString } from "@/lib/money";
import { LinkManager } from "@/components/link-manager";
import { getTerms } from "@/lib/profile";
import { Card } from "@/components/ui/card";
import type {
  ReimbursementLink,
  ReimbursementRequestWithCategory,
  ReimbursementStatus,
} from "@/lib/types";

const STATUS_BADGE: Record<ReimbursementStatus, { text: string; classes: string }> = {
  submitted: { text: "Offen", classes: "bg-primary-50 text-primary-800" },
  accepted: { text: "Angenommen", classes: "bg-income-bg text-income-text" },
  rejected: { text: "Abgelehnt", classes: "bg-expense-bg text-expense-text" },
};

export default async function RequestsPage() {
  const supabase = await createClient();

  const [settings, { data: links }, { data: requests }] = await Promise.all([
    getCachedSettings(),
    supabase
      .from("reimbursement_links")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("reimbursement_requests")
      .select("*, category:categories(*)")
      .order("created_at", { ascending: false }),
  ]);
  const terms = getTerms(settings.profile);

  const all = (requests ?? []) as ReimbursementRequestWithCategory[];
  const open = all.filter((r) => r.status === "submitted");
  const decided = all.filter((r) => r.status !== "submitted");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">
          {terms.requestsTitle}
          {open.length > 0 && (
            <span className="ml-2 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
              {open.length} offen
            </span>
          )}
        </h1>
      </div>

      <LinkManager links={(links ?? []) as ReimbursementLink[]} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Offene Anträge</h2>
        {open.length === 0 ? (
          <Card className="px-4 py-8 text-center">
            <p className="text-sm text-ink-secondary">Keine offenen Anträge.</p>
          </Card>
        ) : (
          <RequestList requests={open} />
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Entschieden</h2>
          <RequestList requests={decided} />
        </section>
      )}
    </div>
  );
}

function RequestList({ requests }: { requests: ReimbursementRequestWithCategory[] }) {
  return (
    <ul className="space-y-3">
      {requests.map((r) => {
        const badge = STATUS_BADGE[r.status];
        return (
          <li key={r.id}>
            <Link
              href={`/antraege/${r.id}`}
              className="block rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-card-hover)"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{r.submitter_name}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-secondary">
                    {r.description || "—"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Kauf am {new Date(r.occurred_on).toLocaleDateString("de-DE")} ·
                    eingereicht {new Date(r.created_at).toLocaleDateString("de-DE")}
                    {r.category && ` · ${r.category.name}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-base font-semibold tabular-nums text-ink">
                    {centsToEuroString(r.amount_cents)} €
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
