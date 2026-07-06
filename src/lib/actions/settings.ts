"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/settings";

export async function updateSettings(input: AppSettings) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { error } = await supabase.from("app_settings").upsert([
    {
      user_id: user.id,
      profile: input.profile,
      org_name: input.orgName?.trim() || null,
      auto_extract: input.autoExtract,
      duplicate_warning: input.duplicateWarning,
      dashboard_period: input.dashboardPeriod,
      default_payment: input.defaultPayment,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    if (/app_settings/.test(error.message) && /(not exist|not find|schema)/i.test(error.message)) {
      throw new Error(
        "Die Einstellungs-Tabelle fehlt noch — bitte Migration 0005 im Supabase SQL Editor ausführen.",
      );
    }
    throw new Error(error.message);
  }

  // Einstellungen wirken überall (Kopfzeile, Navigation, Berichte)
  revalidatePath("/", "layout");
}
