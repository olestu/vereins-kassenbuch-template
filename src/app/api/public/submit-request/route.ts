import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// XML = E-Rechnung (XRechnung/ZUGFeRD-XML)
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/xml|text\/xml)$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PER_LINK_PER_HOUR = 20;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const token = String(form.get("token") ?? "");
  const submitterName = String(form.get("submitter_name") ?? "").trim();
  const submitterContact = String(form.get("submitter_contact") ?? "").trim();
  const amountCents = Number(form.get("amount_cents") ?? 0);
  const occurredOn = String(form.get("occurred_on") ?? "");
  const categoryId = String(form.get("category_id") ?? "");
  const description = String(form.get("description") ?? "").trim();
  const iban = String(form.get("iban") ?? "").replace(/\s+/g, "").toUpperCase();
  const extractedRaw = String(form.get("extracted") ?? "");
  const file = form.get("file");

  // --- Feld-Validierung ---
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 403 });
  }
  if (!submitterName || submitterName.length > 120) {
    return NextResponse.json({ error: "Bitte deinen Namen angeben" }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_00) {
    return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }
  if (iban && (iban.length < 15 || iban.length > 34 || !/^[A-Z0-9]+$/.test(iban))) {
    return NextResponse.json({ error: "Ungültige IBAN" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Bitte einen Beleg anhängen" }, { status: 400 });
  }
  if (!ALLOWED_MIME.test(file.type) && !/\.xml$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Nur Bilder (JPG/PNG/WebP/HEIC), PDF oder E-Rechnungen (XML) sind erlaubt" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 413 });
  }

  const admin = createAdminClient();

  // --- Link validieren ---
  const { data: link } = await admin
    .from("reimbursement_links")
    .select("id, user_id, is_active, expires_at")
    .eq("token", token)
    .single();

  if (
    !link ||
    !link.is_active ||
    (link.expires_at && new Date(link.expires_at) < new Date())
  ) {
    return NextResponse.json(
      { error: "Dieser Link ist ungültig oder abgelaufen" },
      { status: 403 },
    );
  }

  // --- Rate-Limit pro Link ---
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("reimbursement_requests")
    .select("id", { count: "exact", head: true })
    .eq("link_id", link.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_PER_LINK_PER_HOUR) {
    return NextResponse.json(
      { error: "Zu viele Einreichungen — bitte später erneut versuchen" },
      { status: 429 },
    );
  }

  // --- Kategorie prüfen (muss aktive Ausgabe-Kategorie des Kassenwarts sein) ---
  let validCategoryId: string | null = null;
  if (categoryId) {
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", link.user_id)
      .eq("type", "expense")
      .eq("is_active", true)
      .single();
    validCategoryId = category?.id ?? null;
  }

  // --- Beleg hochladen ---
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const receiptPath = `${link.user_id}/antraege/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("receipts")
    .upload(receiptPath, file, { contentType: file.type });

  if (uploadError) {
    console.error("public upload failed", uploadError);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 502 });
  }

  // --- Antrag anlegen ---
  let extracted: unknown = null;
  if (extractedRaw) {
    try {
      extracted = JSON.parse(extractedRaw.slice(0, 20_000));
    } catch {
      extracted = null;
    }
  }

  const statusToken = randomBytes(32).toString("base64url");
  const { error: insertError } = await admin.from("reimbursement_requests").insert([
    {
      link_id: link.id,
      owner_user_id: link.user_id,
      status_token: statusToken,
      submitter_name: submitterName,
      submitter_contact: submitterContact.slice(0, 200) || null,
      amount_cents: amountCents,
      occurred_on: occurredOn,
      category_id: validCategoryId,
      description: description.slice(0, 1000) || null,
      iban: iban || null,
      receipt_path: receiptPath,
      extracted_data: extracted,
    },
  ]);

  if (insertError) {
    await admin.storage.from("receipts").remove([receiptPath]);
    console.error("public insert failed", insertError);
    return NextResponse.json({ error: "Einreichung fehlgeschlagen" }, { status: 502 });
  }

  return NextResponse.json({ statusUrl: `/antrag/${statusToken}` });
}
