import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicRequestForm } from "@/components/public-request-form";
import { DEFAULT_TERMS, getTerms } from "@/lib/profile";
import { getSettings } from "@/lib/settings";

export default async function SubmitRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("reimbursement_links")
    .select("id, user_id, is_active, expires_at")
    .eq("token", token)
    .single();

  const valid =
    link && link.is_active && (!link.expires_at || new Date(link.expires_at) >= new Date());

  if (!valid) {
    return (
      <PublicShell title={DEFAULT_TERMS.publicTitle}>
        <div className="rounded-(--radius-card) border border-line bg-surface p-8 text-center shadow-(--shadow-card)">
          <h1 className="mb-2 text-lg font-semibold text-ink">Link ungültig</h1>
          <p className="text-sm text-ink-secondary">
            Dieser Einreichungs-Link ist abgelaufen oder wurde deaktiviert. Bitte wende
            dich an die Person, die dir den Link geschickt hat.
          </p>
        </div>
      </PublicShell>
    );
  }

  // Begriffe folgen dem Profil des Link-Inhabers
  const terms = getTerms((await getSettings(admin, link.user_id)).profile);

  // Nur das Nötigste an die öffentliche Seite geben: aktive Ausgabe-Kategorien
  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .eq("user_id", link.user_id)
    .eq("type", "expense")
    .eq("is_active", true)
    .order("name");

  return (
    <PublicShell title={terms.publicTitle}>
      <PublicRequestForm
        token={token}
        categories={categories ?? []}
        intro={terms.publicIntro}
      />
    </PublicShell>
  );
}

function PublicShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={48} height={51} className="h-12 w-auto" />
          <span className="text-lg font-semibold text-ink">{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
