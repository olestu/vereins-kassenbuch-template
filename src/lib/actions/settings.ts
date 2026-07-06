"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/supabase/seed-categories";
import type { AppSettings } from "@/lib/settings";

export async function updateSettings(input: AppSettings) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const base = {
    user_id: user.id,
    profile: input.profile,
    org_name: input.orgName?.trim() || null,
    auto_extract: input.autoExtract,
    duplicate_warning: input.duplicateWarning,
    dashboard_period: input.dashboardPeriod,
    default_payment: input.defaultPayment,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("app_settings")
    .upsert([{ ...base, logo_path: input.logoPath }]);

  // Solange Migration 0006 (logo_path) fehlt: restliche Einstellungen trotzdem speichern
  if (error && /logo_path/i.test(error.message)) {
    ({ error } = await supabase.from("app_settings").upsert([base]));
  }

  if (error) {
    if (/app_settings/.test(error.message) && /(not exist|not find|schema)/i.test(error.message)) {
      throw new Error(
        "Die Einstellungs-Tabelle fehlt noch — bitte Migration 0005 im Supabase SQL Editor ausführen.",
      );
    }
    throw new Error(error.message);
  }

  // Erster Speichervorgang eines neuen Nutzers: passende Startkategorien
  // zum gewählten Profil anlegen (falls noch keine existieren)
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    await seedDefaultCategories(supabase, user.id, input.profile);
  }

  // Einstellungen wirken überall (Kopfzeile, Navigation, Berichte)
  revalidatePath("/", "layout");
}
