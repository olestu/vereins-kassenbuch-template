"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EUER_LINES } from "@/lib/profile";
import type { CategoryType } from "@/lib/types";

export async function createCategory(
  name: string,
  type: CategoryType,
  options: { euerLine?: string | null; isPrivate?: boolean } = {},
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data: inserted, error } = await supabase
    .from("categories")
    .insert([
      {
        name: name.trim(),
        type,
        user_id: user.id,
        euer_line: options.euerLine ?? null,
        is_private: options.isPrivate ?? false,
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
  return (inserted as { id: string }).id;
}

/**
 * Legt die offiziellen Buchhaltungskategorien (EÜR-Gruppen der Anlage EÜR) an,
 * die noch nicht existieren — jede direkt mit der passenden Formular-Zuordnung.
 */
export async function createOfficialCategories() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data: existing } = await supabase.from("categories").select("name");
  const have = new Set(
    ((existing ?? []) as { name: string }[]).map((c) => c.name.toLowerCase()),
  );

  const rows = [
    ...EUER_LINES.expense.map((line) => ({ type: "expense" as const, line })),
    ...EUER_LINES.income.map((line) => ({ type: "income" as const, line })),
  ]
    .filter(({ line }) => !have.has(line.toLowerCase()))
    .map(({ line, type }) => ({
      user_id: user.id,
      name: line,
      type,
      euer_line: line,
      is_private: false,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("categories").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/categories");
  return rows.length;
}

export async function setCategoryActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function setCategoryEuerLine(id: string, euerLine: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ euer_line: euerLine })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}
