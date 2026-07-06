"use client";

import { useState, useTransition, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { createCategory } from "@/lib/actions/categories";
import { centsToEuroString, euroStringToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/components/settings-provider";
import type { Category, PaymentMethod, Transaction } from "@/lib/types";

const ReceiptScanner = dynamic(
  () => import("@/components/receipt-scanner").then((m) => m.ReceiptScanner),
  { ssr: false },
);

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Bar" },
  { value: "bank", label: "Überweisung" },
  { value: "other", label: "Sonstige" },
];

// XML = E-Rechnung (XRechnung/ZUGFeRD-XML); Empfangspflicht im B2B seit 2025
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/xml|text\/xml)$/;

function isXmlFile(file: File) {
  return /xml$/.test(file.type) || /\.xml$/i.test(file.name);
}
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Platzhalter-Wert im Kategorie-Select für eine noch anzulegende Kategorie */
const NEW_CATEGORY_VALUE = "__neu__";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  categories,
  existing,
  existingReceiptUrl,
  autoScan = false,
}: {
  categories: Category[];
  existing?: Transaction;
  existingReceiptUrl?: string | null;
  autoScan?: boolean;
}) {
  const router = useRouter();
  const { settings } = useSettings();
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? "");
  const [amount, setAmount] = useState(
    existing ? centsToEuroString(existing.amount_cents) : "",
  );
  const [occurredOn, setOccurredOn] = useState(existing?.occurred_on ?? todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    existing?.payment_method ?? settings.defaultPayment,
  );
  const [payee, setPayee] = useState(existing?.payee ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");

  const [file, setFile] = useState<File | null>(null);
  const receiptPath = existing?.receipt_path ?? null;
  const [ocrRawText, setOcrRawText] = useState<string | null>(existing?.ocr_raw_text ?? null);
  const [extractedData, setExtractedData] = useState<unknown | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [extractWarn, setExtractWarn] = useState(false);
  const [pendingNewCat, setPendingNewCat] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(autoScan);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCategories = categories.filter(
    (c) => c.is_active || c.id === existing?.category_id,
  );
  const income = activeCategories.filter((c) => c.type === "income");
  const expense = activeCategories.filter((c) => c.type === "expense");

  async function runExtraction(image: Blob) {
    setExtracting(true);
    setExtractNote(null);
    setExtractWarn(false);
    try {
      const { extractReceiptSmart } = await import("@/lib/ocr/extract-receipt");
      const result = await extractReceiptSmart(
        image,
        activeCategories.map((c) => ({ name: c.name, type: c.type })),
        { allowLlm: settings.autoExtract },
      );

      if (result.amountCents) setAmount(centsToEuroString(result.amountCents));
      if (result.occurredOn) setOccurredOn(result.occurredOn);
      if (result.merchant && !payee) setPayee(result.merchant);
      if (result.categoryName) {
        const match = activeCategories.find(
          (c) => c.name.toLowerCase() === result.categoryName.toLowerCase(),
        );
        if (match) setCategoryId(match.id);
      } else if (result.newCategory) {
        // Passt keine vorhandene Kategorie: erst schauen, ob eine bestehende
        // bereits derselben offiziellen EÜR-Gruppe zugeordnet ist
        const byLine = activeCategories.find(
          (c) => c.type === "expense" && c.euer_line === result.newCategory,
        );
        if (byLine) {
          setCategoryId(byLine.id);
        } else {
          setPendingNewCat(result.newCategory);
          setCategoryId(NEW_CATEGORY_VALUE);
        }
      }

      setExtractedData(result.raw);
      if (result.engine === "ocr") {
        const raw = result.raw as { text?: string } | null;
        setOcrRawText(raw?.text ?? null);
      }

      if (result.engine === "none" || (!result.amountCents && !result.occurredOn)) {
        setExtractNote("Beleg gelesen, aber nichts sicher erkannt — bitte manuell eintragen.");
      } else if (result.confidence < 0.7) {
        setExtractNote("Automatisch erkannt, aber unsicher — bitte alle Felder genau prüfen.");
        setExtractWarn(true);
      } else {
        setExtractNote(
          result.engine === "llm"
            ? "Beleg automatisch ausgelesen — bitte prüfen."
            : "Betrag/Datum per Texterkennung vorgeschlagen — bitte prüfen.",
        );
      }
    } catch {
      setExtractNote("Auslesung fehlgeschlagen — bitte Felder manuell eintragen.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileChange(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      setExtractNote(null);
      return;
    }

    if (!ALLOWED_MIME.test(selected.type) && !isXmlFile(selected)) {
      setError("Nur Bilder (JPG/PNG/WebP/HEIC), PDF oder E-Rechnungen (XML) sind erlaubt.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError("Datei zu groß (max. 10 MB).");
      return;
    }

    setFile(selected);

    if (isXmlFile(selected)) {
      setExtractNote(
        "E-Rechnung (XML) gespeichert — Betrag und Datum bitte manuell eintragen.",
      );
      return;
    }

    if (selected.type === "application/pdf") {
      setExtracting(true);
      try {
        const { renderPdfFirstPage } = await import("@/lib/pdf/render-first-page");
        const pageImage = await renderPdfFirstPage(selected);
        await runExtraction(pageImage);
      } catch {
        setExtracting(false);
        setExtractNote("PDF gespeichert — Betrag und Datum bitte manuell eintragen.");
      }
      return;
    }

    await runExtraction(selected);
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
    if (!categoryId) {
      setError("Bitte eine Kategorie wählen.");
      return;
    }
    if (!amountCents) {
      setError("Bitte einen gültigen Betrag eintragen.");
      return;
    }

    if (categoryId === NEW_CATEGORY_VALUE && !pendingNewCat) {
      setError("Bitte eine Kategorie wählen.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();

        // Duplikat-Warnung: gleicher Betrag am gleichen Tag existiert schon?
        if (settings.duplicateWarning) {
          let dupQuery = supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .is("voided_at", null)
            .eq("amount_cents", amountCents)
            .eq("occurred_on", occurredOn);
          if (existing) dupQuery = dupQuery.neq("id", existing.id);
          const { count: dupCount } = await dupQuery;
          if (
            (dupCount ?? 0) > 0 &&
            !confirm(
              "Achtung: Es existiert bereits eine Buchung mit gleichem Betrag und Datum. Trotzdem speichern?",
            )
          ) {
            return;
          }
        }

        // Vorgeschlagene neue Kategorie jetzt wirklich anlegen (offizielle
        // EÜR-Gruppe als Name inkl. passender Formular-Zuordnung)
        let finalCategoryId = categoryId;
        if (categoryId === NEW_CATEGORY_VALUE && pendingNewCat) {
          finalCategoryId = await createCategory(pendingNewCat, "expense", {
            euerLine: pendingNewCat,
          });
          toast.success(`Kategorie „${pendingNewCat}" angelegt`);
        }

        let uploadedPath = receiptPath;

        if (file) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Nicht angemeldet");

          const ext = file.name.split(".").pop() ?? "dat";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(path, file, { contentType: file.type || undefined });
          if (uploadError) throw new Error(uploadError.message);

          uploadedPath = path;
        }

        const input = {
          categoryId: finalCategoryId,
          amountCents,
          occurredOn,
          paymentMethod,
          payee,
          description,
          receiptPath: uploadedPath,
          ocrRawText,
          ...(file && {
            receiptFilename: file.name,
            receiptSizeBytes: file.size,
            receiptMime: file.type,
          }),
          ...(extractedData !== null && { extractedData }),
        };

        let newId: string | null = null;
        if (existing) {
          await updateTransaction(existing.id, input);
        } else {
          newId = await createTransaction(input);
        }

        toast.success(existing ? "Buchung aktualisiert" : "Buchung gespeichert");
        // ?neu=<id> hebt die frische Buchung in der Liste kurz hervor
        router.push(newId ? `/transactions?neu=${newId}` : "/transactions");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Speichern";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Card className="max-w-xl p-6">
      {scannerOpen && (
        <ReceiptScanner
          onCapture={handleScanCapture}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="receipt">Beleg (Foto oder PDF)</Label>
          {existingReceiptUrl && !file && (
            <a
              href={existingReceiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-2 inline-block text-sm font-medium text-primary-700 underline hover:text-primary-800"
            >
              Aktuellen Beleg ansehen
            </a>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setScannerOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.83 6l.9-1.8A1 1 0 018.62 3.6h6.76a1 1 0 01.9.55L17.17 6H20a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h2.83zM12 17a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
              Beleg scannen
            </Button>
            <input
              id="receipt"
              type="file"
              accept="image/*,application/pdf,application/xml,text/xml,.xml"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
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
              Beleg wird ausgelesen…
            </p>
          )}
          {extractNote && !extracting && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                extractWarn
                  ? "bg-amber-50 text-amber-800"
                  : "bg-primary-50 text-primary-800"
              }`}
            >
              {extractNote}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              required
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="amount">Betrag (EUR)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="category">Kategorie</Label>
          <Select
            id="category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Bitte wählen…</option>
            <optgroup label="Einnahmen">
              {income.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Ausgaben">
              {expense.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {pendingNewCat && (
                <option value={NEW_CATEGORY_VALUE}>
                  + Neu: {pendingNewCat} (wird beim Speichern angelegt)
                </option>
              )}
            </optgroup>
          </Select>
          {pendingNewCat && categoryId === NEW_CATEGORY_VALUE && (
            <p className="mt-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">
              Keine vorhandene Kategorie passt zu diesem Beleg — die offizielle
              Kategorie „{pendingNewCat}“ wird beim Speichern automatisch angelegt.
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink-secondary">
            Zahlungsart
          </legend>
          <div className="flex gap-4">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex min-h-10 items-center gap-1.5 text-sm text-ink"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={opt.value}
                  checked={paymentMethod === opt.value}
                  onChange={() => setPaymentMethod(opt.value)}
                  className="accent-primary-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="payee">Zahlungsempfänger/-in</Label>
          <Input
            id="payee"
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Verwendungszweck</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-expense-bg px-3 py-2 text-sm font-medium text-expense-text"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={isPending || extracting}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
      </form>
    </Card>
  );
}
