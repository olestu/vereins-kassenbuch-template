import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV_PROFILE, EUER_LINES, type AppProfile } from "@/lib/profile";

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

/**
 * Kleinunternehmer bekommen direkt die offiziellen Anlage-EÜR-Gruppen als
 * Kategorien (je mit korrekter Formular-Zuordnung) plus Privateinlage/-entnahme.
 */
function businessCategorySeeds(): Seed[] {
  return [
    ...EUER_LINES.income.map((line) => ({
      name: line,
      type: "income" as const,
      euer_line: line,
    })),
    { name: "Privateinlage", type: "income" as const, is_private: true },
    ...EUER_LINES.expense.map((line) => ({
      name: line,
      type: "expense" as const,
      euer_line: line,
    })),
    { name: "Privatentnahme", type: "expense" as const, is_private: true },
  ];
}

/**
 * Stellt sicher, dass alle offiziellen Kleinunternehmer-Kategorien existieren —
 * legt nur fehlende an (Abgleich per Name), bestehende bleiben unangetastet.
 * Wird bei jeder Profilwahl „Kleinunternehmen" aufgerufen; idempotent.
 */
export async function ensureBusinessCategories(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase.from("categories").select("name");
  const have = new Set(
    ((existing ?? []) as { name: string }[]).map((c) => c.name.toLowerCase()),
  );

  const rows = businessCategorySeeds()
    .filter((s) => !have.has(s.name.toLowerCase()))
    .map((c) => ({
      user_id: userId,
      name: c.name,
      type: c.type,
      euer_line: c.euer_line ?? null,
      is_private: c.is_private ?? false,
    }));

  if (rows.length > 0) {
    await supabase.from("categories").insert(rows);
  }
  return rows.length;
}

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
  if (profile === "business") {
    await ensureBusinessCategories(supabase, userId);
    return;
  }
  await supabase.from("categories").insert(
    VEREIN_CATEGORIES.map((c) => ({
      user_id: userId,
      name: c.name,
      type: c.type,
      euer_line: c.euer_line ?? null,
      is_private: c.is_private ?? false,
    })),
  );
}
