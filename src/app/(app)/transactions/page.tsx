import { createClient } from "@/lib/supabase/server";
import { TransactionTable } from "@/components/transaction-table";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { Category, TransactionWithCategory } from "@/lib/types";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string; cat?: string; neu?: string }>;
}) {
  const { year: yearParam, q = "", cat = "", neu = "" } = await searchParams;
  const supabase = await createClient();

  // Standard: alle Jahre anzeigen
  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : null;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Ohne die schweren Textspalten (OCR-Text, Auslese-JSON) — die Suche
  // filtert serverseitig trotzdem darauf
  let query = supabase
    .from("transactions")
    .select(
      "id, occurred_on, amount_cents, payment_method, payee, description, voided_at, category:categories(id, name, type)",
    )
    .order("occurred_on", { ascending: false });

  if (year) {
    query = query
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`);
  }

  const search = q.trim();
  if (search) {
    const escaped = search.replace(/[%_,()]/g, "");
    // Sucht auch im erkannten Beleg-Text (OCR) und im ausgelesenen Händlernamen
    query = query.or(
      [
        `payee.ilike.%${escaped}%`,
        `description.ilike.%${escaped}%`,
        `ocr_raw_text.ilike.%${escaped}%`,
        `extracted_data->>haendler.ilike.%${escaped}%`,
      ].join(","),
    );
  }
  if (cat) {
    query = query.eq("category_id", cat);
  }

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Buchungen</h1>
        <ButtonLink href="/transactions/new">+ Neue Buchung</ButtonLink>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-year" className="mb-1 block text-xs font-medium text-ink-secondary">
            Jahr
          </label>
          <Select id="f-year" name="year" defaultValue={year ? String(year) : ""} className="w-32">
            <option value="">Alle Jahre</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-cat" className="mb-1 block text-xs font-medium text-ink-secondary">
            Kategorie
          </label>
          <Select id="f-cat" name="cat" defaultValue={cat} className="w-48">
            <option value="">Alle Kategorien</option>
            {((categories ?? []) as Category[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === "income" ? "Einnahme" : "Ausgabe"})
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-ink-secondary">
            Suche
          </label>
          <Input
            id="f-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Empfänger oder Verwendungszweck…"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-primary-50"
        >
          Filtern
        </button>
      </form>

      <TransactionTable
        transactions={(transactions ?? []) as unknown as TransactionWithCategory[]}
        highlightId={neu || null}
      />
    </div>
  );
}
