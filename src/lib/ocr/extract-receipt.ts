import { parseReceiptText, type ParsedReceipt } from "./parse-receipt-text";
import { processReceiptImage, blobToBase64 } from "@/lib/image/process";
import type { CategoryType } from "@/lib/types";

export interface OcrResult extends ParsedReceipt {
  rawText: string;
}

export interface SmartExtraction {
  amountCents: number | null;
  occurredOn: string | null;
  merchant: string;
  categoryName: string;
  /** Vorschlag für eine NEUE Kategorie (offizielle EÜR-Gruppe), wenn keine passt */
  newCategory: string;
  confidence: number;
  engine: "llm" | "ocr" | "none";
  /** Roh-Ergebnis für das extracted_data-Auditfeld */
  raw: unknown;
}

/** Nur-Tesseract-Auslesung (läuft komplett im Browser, auch ohne Login/API-Key). */
export async function extractReceiptData(file: Blob): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("deu");

  try {
    const {
      data: { text },
    } = await worker.recognize(file as File);

    return { rawText: text, ...parseReceiptText(text) };
  } finally {
    await worker.terminate();
  }
}

/**
 * Auslese-Kette: Vision-LLM (Serverroute) → Tesseract-Fallback → leer.
 * Ergebnis ist immer nur ein Vorschlag — der Nutzer bestätigt im Formular.
 */
export async function extractReceiptSmart(
  image: Blob,
  categories: { name: string; type: CategoryType }[],
  opts: { allowLlm?: boolean } = {},
): Promise<SmartExtraction> {
  const { allowLlm = true } = opts;

  const processed = await processReceiptImage(image);

  if (allowLlm) {
    try {
      const result = await extractViaLlm(processed, categories);
      if (result) return result;
    } catch {
      // weiter zum OCR-Fallback
    }
  }

  try {
    const ocr = await extractReceiptData(processed);
    const found = ocr.amountCents !== null || ocr.occurredOn !== null;
    return {
      amountCents: ocr.amountCents,
      occurredOn: ocr.occurredOn,
      merchant: "",
      categoryName: "",
      newCategory: "",
      confidence: found ? 0.4 : 0,
      engine: "ocr",
      raw: { engine: "tesseract", text: ocr.rawText },
    };
  } catch {
    return {
      amountCents: null,
      occurredOn: null,
      merchant: "",
      categoryName: "",
      newCategory: "",
      confidence: 0,
      engine: "none",
      raw: null,
    };
  }
}

async function extractViaLlm(
  image: Blob,
  categories: { name: string; type: CategoryType }[],
): Promise<SmartExtraction | null> {
  const imageBase64 = await blobToBase64(image);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch("/api/extract-receipt", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        mime: "image/jpeg",
        categories: categories.map((c) => ({ name: c.name, type: c.type })),
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const amountCents =
      typeof data.betrag === "number" ? Math.round(data.betrag * 100) : null;

    return {
      amountCents: amountCents && amountCents > 0 ? amountCents : null,
      occurredOn: data.datum ?? null,
      merchant: data.haendler ?? "",
      categoryName: data.kategorie_vorschlag ?? "",
      newCategory: data.kategorie_neu ?? "",
      confidence: typeof data.konfidenz === "number" ? data.konfidenz : 0.5,
      engine: "llm",
      raw: { engine: "groq", ...data },
    };
  } finally {
    clearTimeout(timeout);
  }
}
