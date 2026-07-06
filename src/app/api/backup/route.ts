import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionsCsv } from "@/lib/csv/build-export";
import type { TransactionWithCategory } from "@/lib/types";

/** Komplett-Backup eines Jahres: Kassenbuch-CSV + alle Belege als ZIP. */
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

  const transactions = (data ?? []) as TransactionWithCategory[];

  const zip = new JSZip();
  zip.file(`kassenbuch-${year}.csv`, buildTransactionsCsv(transactions));

  // Belege mit laufender Nummer passend zur CSV (dort wird aufsteigend nummeriert)
  const receipts = zip.folder("belege")!;
  let missing = 0;
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (!t.receipt_path) continue;

    const { data: file } = await supabase.storage
      .from("receipts")
      .download(t.receipt_path);

    if (!file) {
      missing++;
      continue;
    }

    const nr = String(t.voucher_no ?? i + 1).padStart(3, "0");
    const original = t.receipt_filename ?? t.receipt_path.split("/").pop() ?? "beleg";
    const safeName = original.replace(/[^\w.\-äöüÄÖÜß ]/g, "_").slice(0, 80);
    receipts.file(
      `${nr}_${t.occurred_on}_${safeName}`,
      await file.arrayBuffer(),
    );
  }

  if (missing > 0) {
    zip.file(
      "HINWEIS.txt",
      `${missing} Beleg(e) konnten nicht aus dem Speicher geladen werden und fehlen im Backup.`,
    );
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="kassenbuch-backup-${year}.zip"`,
    },
  });
}
