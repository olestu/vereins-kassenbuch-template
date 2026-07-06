import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";
import { PasswordForm } from "@/components/password-form";
import { InstallApp } from "@/components/install-app";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = await getSettings(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-ink">Einstellungen</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          Profil, Anzeige und Verhalten der App — Änderungen gelten sofort auf allen
          Geräten.
        </p>
      </div>

      <SettingsForm initial={settings} />

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
          Angemeldet als <span className="font-medium text-ink">{user?.email}</span>
        </p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        Hinweis: Storno statt Löschen, fortlaufende Belegnummern und die privaten
        Beleg-Links sind aus Nachvollziehbarkeits- und Sicherheitsgründen fest
        eingebaut und nicht abschaltbar.
      </p>
    </div>
  );
}
