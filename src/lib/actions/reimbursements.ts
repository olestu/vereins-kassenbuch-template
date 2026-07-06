"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/types";

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createLink(label: string, expiresAt: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { error } = await supabase.from("reimbursement_links").insert([
    {
      user_id: user.id,
      token: randomToken(),
      label: label.trim() || null,
      expires_at: expiresAt || null,
    },
  ]);

  if (error) throw new Error(error.message);
  revalidatePath("/antraege");
}

export async function setLinkActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reimbursement_links")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/antraege");
}

export interface AcceptRequestInput {
  categoryId: string;
  amountCents: number;
  occurredOn: string;
  paymentMethod: PaymentMethod;
  payee: string;
  description: string;
}

export async function acceptRequest(requestId: string, input: AcceptRequestInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data: request, error: loadError } = await supabase
    .from("reimbursement_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (loadError || !request) throw new Error("Antrag nicht gefunden");
  if (request.status !== "submitted") throw new Error("Antrag wurde bereits entschieden");

  // 1. Buchung anlegen (Ausgabe, Beleg des Antrags wird direkt verknüpft)
  const { data: created, error: insertError } = await supabase
    .from("transactions")
    .insert([
      {
        user_id: user.id,
        category_id: input.categoryId,
        amount_cents: input.amountCents,
        occurred_on: input.occurredOn,
        payment_method: input.paymentMethod,
        payee: input.payee || request.submitter_name,
        description: input.description || null,
        receipt_path: request.receipt_path,
        extracted_data: request.extracted_data,
      },
    ])
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Buchung konnte nicht angelegt werden");
  }

  // 2. Antrag als angenommen markieren; falls das fehlschlägt, Buchung zurückrollen,
  // damit kein Antrag doppelt angenommen werden kann
  const { error: updateError } = await supabase
    .from("reimbursement_requests")
    .update({
      status: "accepted",
      transaction_id: created.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "submitted");

  if (updateError) {
    await supabase.from("transactions").delete().eq("id", created.id);
    throw new Error(updateError.message);
  }

  revalidatePath("/antraege");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function rejectRequest(requestId: string, comment: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reimbursement_requests")
    .update({
      status: "rejected",
      review_comment: comment.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "submitted");

  if (error) throw new Error(error.message);

  revalidatePath("/antraege");
}
