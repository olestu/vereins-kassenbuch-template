import { createClient, getCachedSettings } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "@/components/settings-form";
import { PasswordForm } from "@/components/password-form";
import { InstallApp } from "@/components/install-app";
import { AdminUserManager, type AdminUserInfo } from "@/components/admin-user-manager";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = await getCachedSettings();

  // Vorschau-URL fürs eigene Logo
  let logoUrl: string | null = null;
  if (settings.logoPath) {
    const { data: signed } = await supabase.storage
      .from("receipts")
      .createSignedUrl(settings.logoPath, 60 * 60);
    logoUrl = signed?.signedUrl ?? null;
  }

  const username =
    (user?.user_metadata as { username?: string } | undefined)?.username ?? null;

  // Admin-Bereich: nur für den Account aus ADMIN_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin =
    !!adminEmail && !!user?.email && user.email.toLowerCase() === adminEmail;

  let adminUsers: AdminUserInfo[] = [];
  if (isAdmin) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
      adminUsers = (data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? "—",
        username:
          ((u.user_metadata as { username?: string } | undefined)?.username ?? "").trim(),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: (u.email ?? "").toLowerCase() === adminEmail,
      }));
    } catch {
      // Admin-Liste ist optional — Seite trotzdem rendern
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-ink">Einstellungen</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          Profil, Anzeige und Verhalten der App — Änderungen gelten sofort auf allen
          Geräten und nur für dein eigenes Konto.
        </p>
      </div>

      <SettingsForm initial={settings} logoUrl={logoUrl} />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Als App installieren</h2>
        <p className="mb-4 mt-1 text-sm text-ink-secondary">
          Aufs Handy oder den Desktop — mit eigenem Symbol, startet schneller und ohne
          Browser-Leiste.
        </p>
        <InstallApp variant="card" />
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Konto</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Angemeldet als{" "}
          <span className="font-medium text-ink">
            {username ? `${username} (${user?.email})` : user?.email}
          </span>
        </p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      {isAdmin && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Nutzerverwaltung (Admin)</h2>
          <p className="mb-4 mt-1 text-sm text-ink-secondary">
            Lege weitere Nutzer mit eigenem Login an — jeder hat seine komplett
            eigenen Buchungen, Belege, Einstellungen und sein eigenes Logo. Passwörter
            kannst du hier jederzeit zurücksetzen.
          </p>
          <AdminUserManager users={adminUsers} />
        </Card>
      )}

      <p className="text-xs text-ink-muted">
        Hinweis: Storno statt Löschen, fortlaufende Belegnummern und die privaten
        Beleg-Links sind aus Nachvollziehbarkeits- und Sicherheitsgründen fest
        eingebaut und nicht abschaltbar.
      </p>
    </div>
  );
}
