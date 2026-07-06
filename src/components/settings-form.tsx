"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<AppSettings>(initial);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSettings(form);
        toast.success("Einstellungen gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }

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
