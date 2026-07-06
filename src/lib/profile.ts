/**
 * App-Profil: "verein" (Standard) oder "business" (Kleinunternehmer).
 * Das aktive Profil kommt aus den App-Einstellungen (Tabelle app_settings);
 * die Umgebungsvariable NEXT_PUBLIC_PROFILE ist nur noch die Voreinstellung
 * (akzeptiert: business | kleinunternehmen | kleinunternehmer).
 */
export type AppProfile = "verein" | "business";

const raw = (process.env.NEXT_PUBLIC_PROFILE ?? "").toLowerCase();
export const ENV_PROFILE: AppProfile =
  raw === "business" || raw.startsWith("kleinunternehm") ? "business" : "verein";

export interface Terms {
  appName: string;
  ownerLabel: string;
  reportName: string;
  reportDescription: string;
  requestsNav: string;
  requestsTitle: string;
  publicTitle: string;
  publicIntro: string;
  auditorSignature: string | null;
}

const BUSINESS_TERMS: Terms = {
  appName: "Kassenbuch",
  ownerLabel: "Inhaber/-in",
  reportName: "EÜR-Bericht",
  reportDescription:
    "Einnahmen-Überschuss-Rechnung nach Anlage-EÜR-Gruppen — die Zahlen zum Übertragen in ELSTER.",
  requestsNav: "Auslagen",
  requestsTitle: "Auslagen-Anträge",
  publicTitle: "Auslagen-Erstattung",
  publicIntro:
    "Du hast etwas ausgelegt? Reiche hier Beleg und Daten ein — die Buchhaltung prüft den Antrag und meldet sich bei dir.",
  auditorSignature: null,
};

const VEREIN_TERMS: Terms = {
  appName: "Vereins-Kassenbuch",
  ownerLabel: "Kassenwart/-wartin",
  reportName: "Kassenbericht",
  reportDescription:
    "Jahresbericht für Mitgliederversammlung und Kassenprüfung — mit Zusammenfassung, ELSTER-Ausfüllhilfe (Anlage EÜR), Kategorien, Buchungsliste und Unterschriftszeilen.",
  requestsNav: "Anträge",
  requestsTitle: "Erstattungsanträge",
  publicTitle: "Erstattungsantrag",
  publicIntro:
    "Du hast etwas für den Verein gekauft? Reiche hier Beleg und Daten ein — der Kassenwart prüft den Antrag und meldet sich bei dir.",
  auditorSignature: "Kassenprüfer/-in",
};

export function getTerms(profile: AppProfile): Terms {
  return profile === "business" ? BUSINESS_TERMS : VEREIN_TERMS;
}

/** Begriffe für Stellen ohne Nutzerkontext (Login, Manifest) — folgen der Env-Voreinstellung. */
export const DEFAULT_TERMS = getTerms(ENV_PROFILE);

/** Kleinunternehmerregelung §19 UStG — Umsatzgrenzen (Stand 2025) */
export const KLEINUNTERNEHMER_LIMITS = {
  previousYear: 25_000_00, // Cent
  currentYear: 100_000_00,
};

/** EÜR-Zeilengruppen (bewusst ohne Formular-Zeilennummern — die ändern sich jährlich) */
export const EUER_LINES: Record<"income" | "expense", string[]> = {
  income: ["Umsatzerlöse (Kleinunternehmer)", "Sonstige betriebliche Einnahmen"],
  expense: [
    "Wareneinkauf und Material",
    "Bezogene Fremdleistungen",
    "Personalkosten",
    "Raumkosten und Miete",
    "Telekommunikation und Internet",
    "Bürobedarf",
    "Reisekosten",
    "Bewirtungskosten",
    "Kfz-Kosten",
    "Versicherungen und Beiträge",
    "Fortbildung und Fachliteratur",
    "Abschreibungen (AfA)",
    "Sonstige Betriebsausgaben",
  ],
};

export const EUER_FALLBACK = {
  income: "Sonstige betriebliche Einnahmen",
  expense: "Sonstige Betriebsausgaben",
};

/**
 * Zuordnung der EÜR-Gruppen zu den konkreten Zeilen der Anlage EÜR.
 * ACHTUNG: Die Zeilennummern verschieben sich von Formularjahr zu Formularjahr —
 * bei einem neuen Jahrgang hier prüfen und `formYear` aktualisieren.
 * Quellen (Stand Formular 2024/2025): sevdesk.de/ratgeber, haufe.de, pierretunger.com
 */
export const ELSTER = {
  formYear: "2024/2025",
  /** §19 UStG: ALLE betrieblichen Einnahmen des Kleinunternehmers gehören in diese eine Zeile */
  income: {
    zeile: "12",
    feld: "Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer (§19 UStG)",
  },
  incomeSum: { zeile: "23", feld: "Summe Betriebseinnahmen" },
  expenseSum: { zeile: "75", feld: "Summe Betriebsausgaben" },
  profit: { zeile: "97", feld: "Steuerpflichtiger Gewinn / Verlust" },
  expenseMap: {
    "Wareneinkauf und Material": {
      zeile: "27",
      feld: "Waren, Rohstoffe und Hilfsstoffe",
    },
    "Bezogene Fremdleistungen": { zeile: "29", feld: "Bezogene Fremdleistungen" },
    Personalkosten: { zeile: "30", feld: "Ausgaben für eigenes Personal" },
    "Abschreibungen (AfA)": {
      zeile: "31–38",
      feld: "Absetzung für Abnutzung (Zeile je nach Art des Wirtschaftsguts)",
    },
    "Raumkosten und Miete": {
      zeile: "39–42",
      feld: "Miete/Pacht für Geschäftsräume und sonstige Raumkosten",
    },
    "Telekommunikation und Internet": {
      zeile: "43",
      feld: "Aufwendungen für Telekommunikation",
    },
    Reisekosten: { zeile: "44", feld: "Übernachtungs- und Reisenebenkosten" },
    "Fortbildung und Fachliteratur": { zeile: "46", feld: "Fortbildungskosten" },
    "Versicherungen und Beiträge": {
      zeile: "52",
      feld: "Beiträge, Gebühren, Abgaben und Versicherungen",
    },
    Bürobedarf: {
      zeile: "60",
      feld: "Übrige unbeschränkt abziehbare Betriebsausgaben",
    },
    "Sonstige Betriebsausgaben": {
      zeile: "60",
      feld: "Übrige unbeschränkt abziehbare Betriebsausgaben",
    },
    Bewirtungskosten: {
      zeile: "63",
      feld: "Bewirtungsaufwendungen",
      hinweis: "Nur 70 % sind abziehbar — abziehbaren Teil eintragen",
    },
    "Kfz-Kosten": { zeile: "68–70", feld: "Kraftfahrzeugkosten" },
  } as Record<string, { zeile: string; feld: string; hinweis?: string }>,
};
