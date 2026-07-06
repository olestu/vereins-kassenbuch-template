export interface ParsedReceipt {
  amountCents: number | null;
  occurredOn: string | null;
}

const DATE_RE = /(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/g;
const AMOUNT_KEYWORD_RE =
  /(?:summe|gesamt|betrag|total|gesamtbetrag)\D{0,15}(\d{1,4}[.,]\d{2})/gi;
const ANY_AMOUNT_RE = /(\d{1,4}[.,]\d{2})\s*(?:€|eur)?/g;

export function parseReceiptText(rawText: string): ParsedReceipt {
  return {
    amountCents: extractAmountCents(rawText),
    occurredOn: extractDate(rawText),
  };
}

function extractAmountCents(text: string): number | null {
  const keywordMatches = [...text.matchAll(AMOUNT_KEYWORD_RE)].map((m) => m[1]);
  const candidates = keywordMatches.length > 0 ? keywordMatches : [...text.matchAll(ANY_AMOUNT_RE)].map((m) => m[1]);

  if (candidates.length === 0) return null;

  // Größter Betrag ist bei Kassenbons meist die Gesamtsumme (Einzelposten sind kleiner).
  const cents = candidates
    .map((c) => Math.round(Number(c.replace(",", ".")) * 100))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (cents.length === 0) return null;
  return Math.max(...cents);
}

function extractDate(text: string): string | null {
  const matches = [...text.matchAll(DATE_RE)];
  if (matches.length === 0) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  for (const m of matches) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;

    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    if (year < currentYear - 5 || year > currentYear + 1) continue;

    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return iso;
  }

  return null;
}
