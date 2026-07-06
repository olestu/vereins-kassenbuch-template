"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateSettings } from "@/lib/actions/settings";
import type { AppProfile } from "@/lib/profile";
import type { AppSettings, DashboardPeriodKey } from "@/lib/settings";
import type { PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const PROFILE_OPTIONS: { value: AppProfile; title: string; description: string }[] = [
  {
    value: "verein",
    title: "Verein",
    description:
      "Kassenbericht mit Unterschriftszeilen für Kassenprüfung und Mitgliederversammlung; Begriffe wie Kassenwart und Erstattungsanträge.",
  },
  {
    value: "business",
    title: "Kleinunternehmen (§19 UStG)",
    description:
      "EÜR-Bericht mit ELSTER-Ausfüllhilfe, §19-Umsatzgrenzen-Wächter, EÜR-Zuordnung an Kategorien und Privatentnahme/-einlage.",
  },
];

const PERIOD_OPTIONS: { value: DashboardPeriodKey; label: string }[] = [
  { value: "alle", label: "Alle Jahre (Kassenbestand)" },
  { value: "30t", label: "Letzte 30 Tage" },
  { value: "90t", label: "Letzte 90 Tage" },
  { value: "12m", label: "Letzte 12 Monate" },
  { value: "jahr", label: "Aktuelles Jahr" },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Bar" },
  { value: "bank", label: "Überweisung" },
  { value: "other", label: "Sonstige" },
];

export function SettingsForm({
  initial,
  logoUrl = null,
}: {
  initial: AppSettings;
  /** Signierte URL des aktuellen eigenen Logos (für die Vorschau) */
  logoUrl?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AppSettings>(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleLogoChange(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      toast.error("Bitte PNG oder JPG wählen.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo zu groß (max. 2 MB).");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        let logoPath = removeLogo ? null : form.logoPath;

        if (logoFile) {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Nicht angemeldet");
          const ext = logoFile.type === "image/png" ? "png" : "jpg";
          const path = `${user.id}/branding/logo-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(path, logoFile, { contentType: logoFile.type });
          if (uploadError) throw new Error(uploadError.message);
          logoPath = path;
        }

        await updateSettings({ ...form, logoPath });

        // Altes Logo aufräumen (best effort)
        if (initial.logoPath && initial.logoPath !== logoPath) {
          const supabase = createClient();
          void supabase.storage.from("receipts").remove([initial.logoPath]);
        }

        setForm((f) => ({ ...f, logoPath }));
        setLogoFile(null);
        setRemoveLogo(false);
        toast.success("Einstellungen gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }

  const shownLogo = logoPreview ?? (removeLogo ? null : logoUrl);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Profil</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Bestimmt Berichte, Begriffe und Zusatzfunktionen. Deine Buchungen und Belege
          bleiben beim Umschalten unverändert.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROFILE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-(--radius-card) border p-4 transition-colors ${
                form.profile === opt.value
                  ? "border-primary-600 bg-primary-50"
                  : "border-line bg-surface hover:border-primary-200"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="radio"
                  name="profile"
                  value={opt.value}
                  checked={form.profile === opt.value}
                  onChange={() => set("profile", opt.value)}
                  className="accent-primary-600"
                />
                {opt.title}
              </span>
              <span className="text-xs leading-relaxed text-ink-secondary">
                {opt.description}
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Name & Anzeige</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="org-name">Vereins- / Firmenname</Label>
            <Input
              id="org-name"
              type="text"
              value={form.orgName ?? ""}
              onChange={(e) => set("orgName", e.target.value || null)}
              placeholder="z.B. SV Musterstadt e.V."
              maxLength={120}
              className="max-w-md"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Erscheint in der Kopfzeile der App und auf den PDF-Berichten.
            </p>
          </div>
          <div>
            <Label htmlFor="logo-upload">Eigenes Logo</Label>
            {shownLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL bzw. lokale Vorschau
              <img
                src={shownLogo}
                alt="Logo-Vorschau"
                className="mb-2 h-12 w-auto rounded border border-line bg-surface p-1"
              />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                className="block text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
              />
              {(shownLogo || form.logoPath) && (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveLogo(true);
                    setLogoFile(null);
                    setLogoPreview(null);
                  }}
                  className="text-sm font-medium text-expense-text hover:underline"
                >
                  Logo entfernen
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Erscheint in deiner Kopfzeile und auf deinen PDF-Berichten (PNG/JPG,
              max. 2 MB). Das App-Symbol auf dem Startbildschirm bleibt das
              gemeinsame Logo der Installation.
            </p>
          </div>
          <div>
            <Label htmlFor="dashboard-period">Standard-Zeitraum der Übersicht</Label>
            <Select
              id="dashboard-period"
              value={form.dashboardPeriod}
              onChange={(e) => set("dashboardPeriod", e.target.value as DashboardPeriodKey)}
              className="max-w-md"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-muted">
              Mit diesem Zeitraum öffnet sich die Übersicht — dort jederzeit umschaltbar.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Buchungen</h2>
        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-ink-secondary">
              Vorausgewählte Zahlungsart bei neuen Buchungen
            </legend>
            <div className="flex gap-4">
              {PAYMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex min-h-10 items-center gap-1.5 text-sm text-ink"
                >
                  <input
                    type="radio"
                    name="defaultPayment"
                    value={opt.value}
                    checked={form.defaultPayment === opt.value}
                    onChange={() => set("defaultPayment", opt.value)}
                    className="accent-primary-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.duplicateWarning}
              onChange={(e) => set("duplicateWarning", e.target.checked)}
              className="mt-0.5 accent-primary-600"
            />
            <span>
              Vor dem Speichern warnen, wenn schon eine Buchung mit gleichem Betrag und
              Datum existiert
            </span>
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Beleg-Auslesung</h2>
        <label className="mt-4 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.autoExtract}
            onChange={(e) => set("autoExtract", e.target.checked)}
            className="mt-0.5 accent-primary-600"
          />
          <span>
            Belege automatisch per KI auslesen (Groq)
            <span className="mt-0.5 block text-xs text-ink-muted">
              Belegfotos werden dafür an Groq (USA) übertragen. Ausgeschaltet läuft nur
              die lokale Texterkennung im Browser — etwas ungenauer, aber die Bilder
              verlassen dein Gerät nicht.
            </span>
          </span>
        </label>
      </Card>

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? "Speichern…" : "Einstellungen speichern"}
      </Button>
    </div>
  );
}
