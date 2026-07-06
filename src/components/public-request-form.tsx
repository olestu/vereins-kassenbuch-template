"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { centsToEuroString, euroStringToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const ReceiptScanner = dynamic(
  () => import("@/components/receipt-scanner").then((m) => m.ReceiptScanner),
  { ssr: false },
);

// XML = E-Rechnung (XRechnung/ZUGFeRD-XML)
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/xml|text\/xml)$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PublicRequestForm({
  token,
  categories,
  intro,
}: {
  token: string;
  categories: { id: string; name: string }[];
  intro: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [iban, setIban] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<unknown | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function runExtraction(image: Blob) {
    setExtracting(true);
    setExtractNote(null);
    try {
      const { extractReceiptSmart } = await import("@/lib/ocr/extract-receipt");
      // Öffentliche Seite: nur lokale Texterkennung (kein LLM-Kontingent für Fremde)
      const result = await extractReceiptSmart(image, [], { allowLlm: false });

      if (result.amountCents) setAmount(centsToEuroString(result.amountCents));
      if (result.occurredOn) setOccurredOn(result.occurredOn);
      setExtractedData(result.raw);

      setExtractNote(
        result.amountCents || result.occurredOn
          ? "Betrag/Datum automatisch vorgeschlagen — bitte prüfen."
          : "Beleg gespeichert — Betrag und Datum bitte eintragen.",
      );
    } catch {
      setExtractNote("Beleg gespeichert — Betrag und Datum bitte eintragen.");
    } finally {
      setExtracting(false);
    }
  }

  function handleFileChange(selected: File | null) {
    setError(null);
    setFile(selected);
    setExtractNote(null);
    if (!selected) return;

    if (!ALLOWED_MIME.test(selected.type) && !/\.xml$/i.test(selected.name)) {
      setError("Nur Bilder (JPG/PNG/WebP/HEIC), PDF oder E-Rechnungen (XML) sind erlaubt.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError("Datei zu groß (max. 10 MB).");
      setFile(null);
      return;
    }
    if (selected.type.startsWith("image/")) {
      void runExtraction(selected);
    }
  }

  function handleScanCapture(scanned: File) {
    setScannerOpen(false);
    setFile(scanned);
    setError(null);
    void runExtraction(scanned);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = euroStringToCents(amount);
    if (!name.trim()) return setError("Bitte deinen Namen angeben.");
    if (!amountCents) return setError("Bitte einen gültigen Betrag eintragen.");
    if (!file) return setError("Bitte einen Beleg anhängen (Foto oder PDF).");

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("submitter_name", name.trim());
      form.set("submitter_contact", contact.trim());
      form.set("amount_cents", String(amountCents));
      form.set("occurred_on", occurredOn);
      form.set("category_id", categoryId);
      form.set("description", description.trim());
      form.set("iban", iban);
      if (extractedData) form.set("extracted", JSON.stringify(extractedData));
      form.set("file", file);

      const res = await fetch("/api/public/submit-request", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Einreichung fehlgeschlagen");
      }

      router.push(`${data.statusUrl}?neu=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einreichung fehlgeschlagen");
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      {scannerOpen && (
        <ReceiptScanner onCapture={handleScanCapture} onClose={() => setScannerOpen(false)} />
      )}

      <p className="mb-5 text-sm text-ink-secondary">{intro}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="p-name">Dein Name *</Label>
          <Input
            id="p-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="p-contact">Kontakt (E-Mail oder Handy, optional)</Label>
          <Input
            id="p-contact"
            maxLength={200}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="p-receipt">Beleg (Foto oder PDF) *</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => setScannerOpen(true)}>
              Beleg scannen
            </Button>
            <input
              id="p-receipt"
              type="file"
              accept="image/*,application/pdf,application/xml,text/xml,.xml"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
            />
          </div>
          {file && (
            <p className="mt-2 text-xs text-ink-muted">
              Ausgewählt: {file.name} ({Math.round(file.size / 1024)} kB)
            </p>
          )}
          {extracting && (
            <p className="mt-2 flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
              Beleg wird gelesen…
            </p>
          )}
          {extractNote && !extracting && (
            <p className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
              {extractNote}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="p-date">Kaufdatum *</Label>
            <Input
              id="p-date"
              type="date"
              required
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="p-amount">Betrag (EUR) *</Label>
            <Input
              id="p-amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <Label htmlFor="p-category">Kategorie (optional)</Label>
            <Select
              id="p-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Weiß ich nicht</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="p-description">Was wurde gekauft? *</Label>
          <Textarea
            id="p-description"
            required
            maxLength={1000}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z.B. Getränke für die Vereinsfeier"
          />
        </div>

        <div>
          <Label htmlFor="p-iban">IBAN für die Rückerstattung (optional)</Label>
          <Input
            id="p-iban"
            maxLength={42}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="DE.."
          />
          <p className="mt-1 text-xs text-ink-muted">
            Wird nur für die Rückerstattung verwendet und nur intern eingesehen.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-expense-bg px-3 py-2 text-sm font-medium text-expense-text"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting || extracting} className="w-full">
          {submitting ? "Wird eingereicht…" : "Antrag einreichen"}
        </Button>
      </form>
    </Card>
  );
}
