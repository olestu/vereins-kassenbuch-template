import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV_PROFILE, type AppProfile } from "@/lib/profile";

type Seed = {
  name: string;
  type: "income" | "expense";
  euer_line?: string;
  is_private?: boolean;
};

const VEREIN_CATEGORIES: Seed[] = [
  { name: "Mitgliedsbeiträge", type: "income" },
  { name: "Spenden", type: "income" },
  { name: "Veranstaltungen", type: "income" },
  { name: "Vereinsbedarf", type: "expense", euer_line: "Bürobedarf" },
  { name: "Raummiete", type: "expense", euer_line: "Raumkosten und Miete" },
  { name: "Veranstaltungskosten", type: "expense", euer_line: "Sonstige Betriebsausgaben" },
  { name: "Sonstiges", type: "expense", euer_line: "Sonstige Betriebsausgaben" },
];

const BUSINESS_CATEGORIES: Seed[] = [
  { name: "Umsatzerlöse", type: "income", euer_line: "Umsatzerlöse (Kleinunternehmer)" },
  { name: "Sonstige Einnahmen", type: "income", euer_line: "Sonstige betriebliche Einnahmen" },
  { name: "Privateinlage", type: "income", is_private: true },
  { name: "Wareneinkauf", type: "expense", euer_line: "Wareneinkauf und Material" },
  { name: "Fremdleistungen", type: "expense", euer_line: "Bezogene Fremdleistungen" },
  { name: "Bürobedarf", type: "expense", euer_line: "Bürobedarf" },
  { name: "Telefon & Internet", type: "expense", euer_line: "Telekommunikation und Internet" },
  { name: "Reisekosten", type: "expense", euer_line: "Reisekosten" },
  { name: "Bewirtung", type: "expense", euer_line: "Bewirtungskosten" },
  { name: "Miete & Raumkosten", type: "expense", euer_line: "Raumkosten und Miete" },
  { name: "Versicherungen & Beiträge", type: "expense", euer_line: "Versicherungen und Beiträge" },
  { name: "Fortbildung", type: "expense", euer_line: "Fortbildung und Fachliteratur" },
  { name: "Sonstige Betriebsausgaben", type: "expense", euer_line: "Sonstige Betriebsausgaben" },
  { name: "Privatentnahme", type: "expense", is_private: true },
];

/**
 * Legt die Standardkategorien an (nur beim allerersten Login relevant).
 * Der Aufrufer prüft vorher, ob schon Kategorien existieren — so kann die
 * Zähl-Abfrage parallel zu anderen laufen. Idempotent dank unique-Constraint.
 */
export async function seedDefaultCategories(
  supabase: SupabaseClient,
  userId: string,
  profile: AppProfile = ENV_PROFILE,
) {
  const seeds = profile === "business" ? BUSINESS_CATEGORIES : VEREIN_CATEGORIES;
  await supabase.from("categories").insert(
    seeds.map((c) => ({
      user_id: userId,
      name: c.name,
      type: c.type,
      euer_line: c.euer_line ?? null,
      is_private: c.is_private ?? false,
    })),
  );
}
