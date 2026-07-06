import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/transaction-form";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  const { scan } = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-ink">Neue Buchung</h1>
      <TransactionForm categories={categories ?? []} autoScan={scan === "1"} />
    </div>
  );
}
