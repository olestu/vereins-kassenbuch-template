import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV_PROFILE, type AppProfile } from "@/lib/profile";
import type { PaymentMethod } from "@/lib/types";

/** Standard-Zeitraum der Übersicht (Schlüssel wie in app_settings.dashboard_period) */
export type DashboardPeriodKey = "alle" | "30t" | "90t" | "12m" | "jahr";

export interface AppSettings {
  profile: AppProfile;
  /** Vereins-/Firmenname für Kopfzeile und PDF-Berichte (null = App-Name) */
  orgName: string | null;
  /** Belege automatisch per Vision-LLM (Groq) auslesen; false = nur lokale Texterkennung */
  autoExtract: boolean;
  /** Warnung bei Buchung mit gleichem Betrag und Datum */
  duplicateWarning: boolean;
  dashboardPeriod: DashboardPeriodKey;
  /** Vorausgewählte Zahlungsart bei neuen Buchungen */
  defaultPayment: PaymentMethod;
  /** Eigenes Logo (Storage-Pfad im receipts-Bucket, {uid}/branding/…) */
  logoPath: string | null;
  /** true = Nutzer hat seine Einstellungen (v.a. das Profil) schon einmal gespeichert */
  saved: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  profile: ENV_PROFILE,
  orgName: process.env.VEREIN_NAME ?? null,
  autoExtract: true,
  duplicateWarning: true,
  dashboardPeriod: "alle",
  defaultPayment: "cash",
  logoPath: null,
  saved: false,
};

interface SettingsRow {
  profile: string | null;
  org_name: string | null;
  auto_extract: boolean | null;
  duplicate_warning: boolean | null;
  dashboard_period: string | null;
  default_payment: string | null;
  logo_path?: string | null;
}

const PERIOD_KEYS: DashboardPeriodKey[] = ["alle", "30t", "90t", "12m", "jahr"];
const PAYMENT_KEYS: PaymentMethod[] = ["cash", "bank", "other"];

/**
 * Lädt die Einstellungen des Nutzers. Mit dem RLS-Client liefert die Abfrage
 * automatisch nur die eigene Zeile; mit dem Admin-Client (öffentliche Seiten)
 * muss die userId des Inhabers übergeben werden. Fehlt die Zeile oder die
 * Tabelle (Migration 0005 noch nicht ausgeführt), gelten die Env-Voreinstellungen.
 */
export async function getSettings(
  supabase: SupabaseClient,
  userId?: string,
): Promise<AppSettings> {
  try {
    // select("*") statt Spaltenliste: bleibt robust, wenn eine neue Spalte
    // (z.B. logo_path aus Migration 0006) noch nicht angelegt wurde
    let query = supabase.from("app_settings").select("*");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;

    const row = data as SettingsRow;
    return {
      saved: true,
      profile:
        row.profile === "business" || row.profile === "verein"
          ? row.profile
          : DEFAULT_SETTINGS.profile,
      orgName: row.org_name?.trim() || DEFAULT_SETTINGS.orgName,
      autoExtract: row.auto_extract ?? DEFAULT_SETTINGS.autoExtract,
      duplicateWarning: row.duplicate_warning ?? DEFAULT_SETTINGS.duplicateWarning,
      dashboardPeriod: PERIOD_KEYS.includes(row.dashboard_period as DashboardPeriodKey)
        ? (row.dashboard_period as DashboardPeriodKey)
        : DEFAULT_SETTINGS.dashboardPeriod,
      defaultPayment: PAYMENT_KEYS.includes(row.default_payment as PaymentMethod)
        ? (row.default_payment as PaymentMethod)
        : DEFAULT_SETTINGS.defaultPayment,
      logoPath: row.logo_path ?? null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
