"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin = der Account, dessen E-Mail in der Umgebungsvariable ADMIN_EMAIL steht.
 * Bewusst NICHT als Datenbank-Flag: das dürfte sich sonst jeder Nutzer über
 * seine eigenen (RLS-schreibbaren) Einstellungen selbst verleihen.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    throw new Error("Kein Admin konfiguriert (Umgebungsvariable ADMIN_EMAIL fehlt).");
  }
  if (!user?.email || user.email.toLowerCase() !== adminEmail) {
    throw new Error("Nur der Admin-Account darf Nutzer verwalten.");
  }
  return user;
}

export async function createAppUser(email: string, username: string, password: string) {
  await requireAdmin();

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  if (!cleanUsername) {
    throw new Error("Bitte einen Benutzernamen angeben.");
  }
  if (password.length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen haben.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { username: cleanUsername },
  });
  if (error) throw new Error(error.message);

  revalidatePath("/einstellungen");
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireAdmin();

  if (newPassword.length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen haben.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}
