import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { centsToEuroString } from "@/lib/money";
import { ELSTER, EUER_FALLBACK, getTerms } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import type { TransactionWithCategory } from "@/lib/types";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const INK = rgb(0.1, 0.12, 0.17);
const MUTED = rgb(0.48, 0.51, 0.59);
const LINE = rgb(0.85, 0.87, 0.91);
const GREEN = rgb(0.05, 0.48, 0.33);
const RED = rgb(0.69, 0.16, 0.16);

/**
 * Jahresbericht als PDF: Kassenbericht (Verein) bzw. EÜR-Bericht (Kleinunternehmer).
 * Stornierte Buchungen sind ausgeschlossen; private Buchungen (Entnahme/Einlage)
 * zählen im Business-Profil nicht zur EÜR, wohl aber zum Kassenbestand.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const settings = await getSettings(supabase);
  const terms = getTerms(settings.profile);
  const isBusiness = settings.profile === "business";

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "voucher_no, occurred_on, amount_cents, description, payee, category:categories(name, type, is_private, euer_line)",
    )
    .is("voided_at", null)
    .order("occurred_on", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = (data ?? []) as unknown as TransactionWithCategory[];
  const signed = (t: TransactionWithCategory) =>
    t.category.type === "income" ? t.amount_cents : -t.amount_cents;

  const inYear = all.filter((t) => new Date(t.occurred_on).getFullYear() === year);
  const startBalance = all
    .filter((t) => new Date(t.occurred_on).getFullYear() < year)
    .reduce((s, t) => s + signed(t), 0);

  // Betriebliche Summen (im Business-Profil ohne Privatentnahmen/-einlagen)
  const operative = inYear.filter((t) => !t.category.is_private);
  const incomeCents = operative
    .filter((t) => t.category.type === "income")
    .reduce((s, t) => s + t.amount_cents, 0);
  const expenseCents = operative
    .filter((t) => t.category.type === "expense")
    .reduce((s, t) => s + t.amount_cents, 0);
  const privateIn = inYear
    .filter((t) => t.category.is_private && t.category.type === "income")
    .reduce((s, t) => s + t.amount_cents, 0);
  const privateOut = inYear
    .filter((t) => t.category.is_private && t.category.type === "expense")
    .reduce((s, t) => s + t.amount_cents, 0);
  const endBalance = startBalance + inYear.reduce((s, t) => s + signed(t), 0);
  const result = incomeCents - expenseCents;

  /** Gruppierung: Verein nach Kategoriename, Business nach EÜR-Zeilengruppe */
  const grouped = (type: "income" | "expense") => {
    const totals = new Map<string, number>();
    for (const t of operative) {
      if (t.category.type !== type) continue;
      const key = isBusiness
        ? (t.category.euer_line ?? EUER_FALLBACK[type])
        : t.category.name;
      totals.set(key, (totals.get(key) ?? 0) + t.amount_cents);
    }
    return Array.from(totals, ([name, cents]) => ({ name, cents })).sort(
      (a, b) => b.cents - a.cents,
    );
  };

  /** Für die ELSTER-Seite: immer nach EÜR-Zeilengruppe (unabhängig vom Profil) */
  const euerGrouped = (type: "income" | "expense") => {
    const totals = new Map<string, number>();
    for (const t of operative) {
      if (t.category.type !== type) continue;
      const key = t.category.euer_line ?? EUER_FALLBACK[type];
      totals.set(key, (totals.get(key) ?? 0) + t.amount_cents);
    }
    return Array.from(totals, ([name, cents]) => ({ name, cents })).sort(
      (a, b) => b.cents - a.cents,
    );
  };

  // --- PDF aufbauen ---
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    logo = await doc.embedPng(
      await readFile(path.join(process.cwd(), "public", "logo.png")),
    );
  } catch {
    // ohne Logo weitermachen
  }

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  const width = A4.w - 2 * MARGIN;
  const eur = (cents: number) => `${centsToEuroString(cents)} €`;

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };
  const text = (
    s: string,
    opts: {
      x?: number;
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      right?: number;
    } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const x =
      opts.right !== undefined
        ? opts.right - f.widthOfTextAtSize(s, size)
        : (opts.x ?? MARGIN);
    page.drawText(s, { x, y, size, font: f, color: opts.color ?? INK });
  };
  const hr = () => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + width, y },
      thickness: 0.7,
      color: LINE,
    });
  };
  const truncate = (s: string, f: PDFFont, size: number, max: number) => {
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(`${out}…`, size) > max) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  };

  // Kopf
  const title = isBusiness
    ? `Einnahmen-Überschuss-Rechnung ${year}`
    : `Kassenbericht ${year}`;
  if (logo) {
    const h = 42;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: MARGIN, y: y - h + 8, width: w, height: h });
  }
  text(title, { x: MARGIN + (logo ? 52 : 0), size: 18, font: bold });
  y -= 16;
  text(settings.orgName ?? terms.appName, {
    x: MARGIN + (logo ? 52 : 0),
    size: 10,
    color: MUTED,
  });
  y -= 8;
  text(`erstellt am ${new Date().toLocaleDateString("de-DE")}`, {
    right: MARGIN + width,
    size: 9,
    color: MUTED,
  });
  y -= 18;
  hr();
  y -= 24;

  // Zusammenfassung
  text("Zusammenfassung", { size: 13, font: bold });
  y -= 20;
  const summary: [string, string, ReturnType<typeof rgb>][] = isBusiness
    ? [
        [`Betriebseinnahmen ${year}`, `+ ${eur(incomeCents)}`, GREEN],
        [`Betriebsausgaben ${year}`, `- ${eur(expenseCents)}`, RED],
        [
          `Gewinn / Verlust ${year} (EÜR)`,
          `${result >= 0 ? "+" : "-"} ${eur(Math.abs(result))}`,
          result >= 0 ? GREEN : RED,
        ],
        [`Privateinlagen ${year}`, eur(privateIn), MUTED],
        [`Privatentnahmen ${year}`, eur(privateOut), MUTED],
        [`Kassen-/Kontostand am 01.01.${year}`, eur(startBalance), INK],
        [`Kassen-/Kontostand am 31.12.${year}`, eur(endBalance), INK],
      ]
    : [
        [`Kassenbestand am 01.01.${year}`, eur(startBalance), INK],
        [`Einnahmen ${year}`, `+ ${eur(incomeCents)}`, GREEN],
        [`Ausgaben ${year}`, `- ${eur(expenseCents)}`, RED],
        [
          `Überschuss / Fehlbetrag ${year}`,
          `${result >= 0 ? "+" : "-"} ${eur(Math.abs(result))}`,
          result >= 0 ? GREEN : RED,
        ],
        [`Kassenbestand am 31.12.${year}`, eur(endBalance), INK],
      ];
  for (const [label, value, color] of summary) {
    text(label, { size: 10.5 });
    text(value, { right: MARGIN + width, size: 10.5, font: bold, color });
    y -= 17;
  }
  y -= 12;

  // --- Seite 2: ELSTER-Ausfüllhilfe mit konkreten Formularzeilen (beide Profile) ---
  {
    newPage();
    text(`ELSTER-Ausfüllhilfe — Anlage EÜR (Formular ${ELSTER.formYear})`, {
      size: 15,
      font: bold,
    });
    y -= 14;
    text(
      "Diese Beträge trägst du in ELSTER in die Anlage EÜR ein — Zeile für Zeile:",
      { size: 10, color: MUTED },
    );
    if (!isBusiness) {
      y -= 13;
      text(
        "Für Vereine relevant, wenn der Gewinn per EÜR ermittelt und eine Anlage EÜR abgegeben wird.",
        { size: 9, color: MUTED },
      );
    }
    y -= 24;

    const colZ = { zeile: MARGIN, feld: MARGIN + 70, amt: MARGIN + width };
    const zHeader = () => {
      text("Zeile", { x: colZ.zeile, size: 9, font: bold, color: MUTED });
      text("Feld im Formular", { x: colZ.feld, size: 9, font: bold, color: MUTED });
      text("Betrag", { right: colZ.amt, size: 9, font: bold, color: MUTED });
      y -= 7;
      hr();
      y -= 15;
    };
    const zRow = (
      zeile: string,
      feld: string,
      betrag: string,
      opts: { bold?: boolean; color?: ReturnType<typeof rgb>; hinweis?: string } = {},
    ) => {
      ensure(opts.hinweis ? 46 : 30);
      const f = opts.bold ? bold : font;
      text(zeile, { x: colZ.zeile, size: 10, font: f });
      text(truncate(feld, f, 10, width - 180), { x: colZ.feld, size: 10, font: f });
      text(betrag, { right: colZ.amt, size: 10, font: f, color: opts.color ?? INK });
      y -= 15;
      if (opts.hinweis) {
        text(`Hinweis: ${opts.hinweis}`, { x: colZ.feld, size: 8.5, color: MUTED });
        y -= 14;
      }
    };

    // Betriebseinnahmen
    text("Betriebseinnahmen", { size: 12, font: bold });
    y -= 18;
    zHeader();
    zRow(ELSTER.income.zeile, ELSTER.income.feld, eur(incomeCents));
    zRow(ELSTER.incomeSum.zeile, ELSTER.incomeSum.feld, eur(incomeCents), {
      bold: true,
      color: GREEN,
    });
    y -= 14;

    // Betriebsausgaben: EÜR-Gruppen auf Formularzeilen aggregieren
    text("Betriebsausgaben", { size: 12, font: bold });
    y -= 18;
    zHeader();
    const byZeile = new Map<
      string,
      { feld: string; cents: number; hinweis?: string; sort: number }
    >();
    for (const g of euerGrouped("expense")) {
      const map =
        ELSTER.expenseMap[g.name] ?? ELSTER.expenseMap["Sonstige Betriebsausgaben"];
      const existing = byZeile.get(map.zeile);
      if (existing) {
        existing.cents += g.cents;
      } else {
        byZeile.set(map.zeile, {
          feld: map.feld,
          cents: g.cents,
          hinweis: map.hinweis,
          sort: parseInt(map.zeile, 10),
        });
      }
    }
    for (const [zeile, row] of [...byZeile.entries()].sort((a, b) => a[1].sort - b[1].sort)) {
      const hinweis =
        row.hinweis && zeile === "63"
          ? `${row.hinweis}: 70 % = ${eur(Math.round(row.cents * 0.7))}`
          : row.hinweis;
      zRow(zeile, row.feld, eur(row.cents), { hinweis });
    }
    zRow(ELSTER.expenseSum.zeile, ELSTER.expenseSum.feld, eur(expenseCents), {
      bold: true,
      color: RED,
    });
    y -= 14;

    // Ergebnis
    text("Ergebnis", { size: 12, font: bold });
    y -= 18;
    zHeader();
    zRow(
      ELSTER.profit.zeile,
      ELSTER.profit.feld,
      `${result >= 0 ? "+" : "-"} ${eur(Math.abs(result))}`,
      { bold: true, color: result >= 0 ? GREEN : RED },
    );

    y -= 20;
    ensure(60);
    text(
      `Hinweis: Zeilennummern beziehen sich auf die Anlage EÜR ${ELSTER.formYear}. Bei einem neueren`,
      { size: 8.5, color: MUTED },
    );
    y -= 12;
    text(
      "Formularjahr können sich Nummern verschieben — im Zweifel anhand der Feldbezeichnung zuordnen.",
      { size: 8.5, color: MUTED },
    );
    y -= 12;
    text(
      "Privatentnahmen/-einlagen gehören nicht in die Anlage EÜR. Keine Steuerberatung.",
      { size: 8.5, color: MUTED },
    );
    newPage();
  }

  // Kategorien-/EÜR-Blöcke
  const categoryBlock = (
    blockTitle: string,
    rows: { name: string; cents: number }[],
    total: number,
  ) => {
    ensure(60 + rows.length * 15);
    text(blockTitle, { size: 13, font: bold });
    y -= 18;
    for (const r of rows) {
      ensure(30);
      text(truncate(r.name, font, 10, width - 120), { size: 10 });
      text(eur(r.cents), { right: MARGIN + width, size: 10 });
      y -= 15;
    }
    hr();
    y -= 14;
    text("Summe", { size: 10.5, font: bold });
    text(eur(total), { right: MARGIN + width, size: 10.5, font: bold });
    y -= 26;
  };
  categoryBlock(
    isBusiness ? "Betriebseinnahmen nach EÜR-Gruppe" : "Einnahmen nach Kategorie",
    grouped("income"),
    incomeCents,
  );
  categoryBlock(
    isBusiness ? "Betriebsausgaben nach EÜR-Gruppe" : "Ausgaben nach Kategorie",
    grouped("expense"),
    expenseCents,
  );

  // Buchungsliste (inkl. privater Buchungen, gekennzeichnet)
  ensure(80);
  text(`Buchungen ${year} (${inYear.length})`, { size: 13, font: bold });
  y -= 18;
  const col = {
    nr: MARGIN,
    date: MARGIN + 34,
    cat: MARGIN + 96,
    txt: MARGIN + 222,
    amt: MARGIN + width,
  };
  const header = () => {
    text("Nr.", { x: col.nr, size: 8.5, font: bold, color: MUTED });
    text("Datum", { x: col.date, size: 8.5, font: bold, color: MUTED });
    text("Kategorie", { x: col.cat, size: 8.5, font: bold, color: MUTED });
    text("Beschreibung", { x: col.txt, size: 8.5, font: bold, color: MUTED });
    text("Betrag", { right: col.amt, size: 8.5, font: bold, color: MUTED });
    y -= 6;
    hr();
    y -= 13;
  };
  header();
  inYear.forEach((t, i) => {
    if (y < MARGIN + 20) {
      newPage();
      header();
    }
    const isIncome = t.category.type === "income";
    const catName = t.category.is_private
      ? `${t.category.name} (privat)`
      : t.category.name;
    text(String(t.voucher_no ?? i + 1), { x: col.nr, size: 9 });
    text(new Date(t.occurred_on).toLocaleDateString("de-DE"), { x: col.date, size: 9 });
    text(truncate(catName, font, 9, 118), { x: col.cat, size: 9 });
    text(truncate(t.description || t.payee || "—", font, 9, 190), { x: col.txt, size: 9 });
    text(`${isIncome ? "+" : "-"} ${eur(t.amount_cents)}`, {
      right: col.amt,
      size: 9,
      color: t.category.is_private ? MUTED : isIncome ? GREEN : RED,
    });
    y -= 14;
  });

  // Unterschriften
  ensure(150);
  y -= 40;
  text(isBusiness ? "Erstellt und geprüft:" : "Der Kassenbericht wurde geprüft:", {
    size: 10,
    color: MUTED,
  });
  y -= 52;
  const sig = (x: number, label: string) => {
    page.drawLine({
      start: { x, y },
      end: { x: x + 140, y },
      thickness: 0.8,
      color: INK,
    });
    page.drawText(label, { x, y: y - 12, size: 8.5, font, color: MUTED });
  };
  sig(MARGIN, "Ort, Datum");
  sig(MARGIN + 178, terms.ownerLabel);
  if (terms.auditorSignature) {
    sig(MARGIN + 356, terms.auditorSignature);
  }

  const bytes = await doc.save();
  const filename = isBusiness ? `euer-${year}.pdf` : `kassenbericht-${year}.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
