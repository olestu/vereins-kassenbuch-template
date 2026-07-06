import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedSettings } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/supabase/seed-categories";
import { getTerms } from "@/lib/profile";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinks } from "@/components/nav-links";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsProvider } from "@/components/settings-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // Lokale JWT-Prüfung (kein Netzwerk-Roundtrip); die Middleware hat die
  // Session bereits validiert und ggf. erneuert, RLS sichert jede Abfrage ab.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect("/login");
  }

  // Alle Layout-Abfragen parallel starten (.then() feuert die Requests sofort)
  const openRequestsP = supabase
    .from("reimbursement_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .then((r) => r.count ?? 0);
  const categoryCountP = supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .then((r) => r.count ?? 0);

  const settings = await getCachedSettings();
  const terms = getTerms(settings.profile);
  const [openRequests, categoryCount] = await Promise.all([
    openRequestsP,
    categoryCountP,
  ]);

  // Nur beim allerersten Login nötig
  if (categoryCount === 0) {
    await seedDefaultCategories(supabase, userId, settings.profile);
  }

  return (
    <SettingsProvider settings={settings}>
      <div className="min-h-screen bg-page">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
              <Image
                src="/logo.png"
                alt="Logo"
                width={28}
                height={30}
                className="h-7 w-auto shrink-0"
                priority
              />
              <span className="truncate">{settings.orgName ?? terms.appName}</span>
            </span>
            <div className="hidden items-center gap-3 md:flex">
              <NavLinks openRequests={openRequests} />
              <span className="h-4 w-px bg-line" />
              <Link
                href="/einstellungen"
                title="Einstellungen"
                aria-label="Einstellungen"
                className="rounded-lg p-1.5 text-ink-secondary hover:bg-primary-50 hover:text-ink"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.34 4.34a1.72 1.72 0 013.32 0l.21.72a1.72 1.72 0 002.42 1l.68-.33a1.72 1.72 0 012.35 2.35l-.33.68a1.72 1.72 0 001 2.42l.72.21a1.72 1.72 0 010 3.32l-.72.21a1.72 1.72 0 00-1 2.42l.33.68a1.72 1.72 0 01-2.35 2.35l-.68-.33a1.72 1.72 0 00-2.42 1l-.21.72a1.72 1.72 0 01-3.32 0l-.21-.72a1.72 1.72 0 00-2.42-1l-.68.33a1.72 1.72 0 01-2.35-2.35l.33-.68a1.72 1.72 0 00-1-2.42l-.72-.21a1.72 1.72 0 010-3.32l.72-.21a1.72 1.72 0 001-2.42l-.33-.68a1.72 1.72 0 012.35-2.35l.68.33a1.72 1.72 0 002.42-1l.21-.72zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>
        {/* pb-24: Platz für die mobile Bottom-Nav (h-16 + safe area) */}
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:py-8 md:pb-8">
          {children}
        </main>
        <BottomNav openRequests={openRequests} />
      </div>
    </SettingsProvider>
  );
}
