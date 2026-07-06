import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/category-manager";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-ink">Kategorien</h1>
      <CategoryManager categories={categories ?? []} />
    </div>
  );
}
