import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionsCsv } from "@/lib/csv/build-export";
import type { TransactionWithCategory } from "@/lib/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") ?? String(new Date().getFullYear());

  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .is("voided_at", null)
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`)
    .order("occurred_on", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = buildTransactionsCsv((data ?? []) as TransactionWithCategory[]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kassenbuch-${year}.csv"`,
    },
  });
}
