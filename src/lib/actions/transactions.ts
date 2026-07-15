"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextVoucherNo } from "@/lib/voucher";
import type { PaymentMethod } from "@/lib/types";

export interface TransactionInput {
  categoryId: string;
  amountCents: number;
  occurredOn: string;
  paymentMethod: PaymentMethod;
  payee: string;
  description: string;
  receiptPath: string | null;
  ocrRawText: string | null;
  receiptFilename?: string | null;
  receiptSizeBytes?: number | null;
  receiptMime?: string | null;
  extractedData?: unknown | null;
}

export async function createTransaction(input: TransactionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  // Belegnummer vergeben; bei gleichzeitiger Buchung (zweites Gerät) schlägt der
  // Unique-Index an — dann Nummer neu ermitteln und erneut versuchen
  for (let attempt = 0; attempt < 3; attempt++) {
    const voucherNo = await nextVoucherNo(supabase);

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: user.id,
          voucher_no: voucherNo,
          category_id: input.categoryId,
          amount_cents: input.amountCents,
          occurred_on: input.occurredOn,
          payment_method: input.paymentMethod,
          payee: input.payee || null,
          description: input.description || null,
          receipt_path: input.receiptPath,
          ocr_raw_text: input.ocrRawText,
          receipt_filename: input.receiptFilename ?? null,
          receipt_size_bytes: input.receiptSizeBytes ?? null,
          receipt_mime: input.receiptMime ?? null,
          extracted_data: input.extractedData ?? null,
        },
      ])
      .select("id")
      .single();

    if (!error) {
      revalidatePath("/transactions");
      revalidatePath("/dashboard");
      // ID für das Hervorheben der neuen Buchung in der Liste
      return (inserted as { id: string } | null)?.id ?? null;
    }
    if (error.code !== "23505") throw new Error(error.message);
  }

  throw new Error("Belegnummer-Konflikt — bitte noch einmal auf Speichern tippen.");
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: input.categoryId,
      amount_cents: input.amountCents,
      occurred_on: input.occurredOn,
      payment_method: input.paymentMethod,
      payee: input.payee || null,
      description: input.description || null,
      receipt_path: input.receiptPath,
      ...(input.receiptFilename !== undefined && {
        receipt_filename: input.receiptFilename,
        receipt_size_bytes: input.receiptSizeBytes ?? null,
        receipt_mime: input.receiptMime ?? null,
      }),
      ...(input.extractedData !== undefined && { extracted_data: input.extractedData }),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

/**
 * Storno statt Löschen (GoBD): Die Buchung bleibt inkl. Beleg erhalten und
 * sichtbar, zählt aber in keiner Summe/Auswertung mehr mit. Nicht umkehrbar.
 */
export async function voidTransaction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)
    .is("voided_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
