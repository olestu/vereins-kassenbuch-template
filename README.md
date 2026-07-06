# Vereins-Kassenbuch

Open-Source-Kassenbuch für kleine **Vereine und Kleinunternehmer** (§19 UStG): digitale
Belegerfassung mit Kamera-Scanner, Einnahmen-/Ausgabenbuchung und Erstattungsanträge per
teilbarem Link — als Grundlage für die jährliche Steuererklärung. Next.js + Supabase
(Postgres, Auth, Storage), kostenlos hostbar auf Vercel, installierbar als PWA. Gebaut
für eine einzelne Person (Kassenwart bzw. Inhaber/-in) als Nutzer; läuft komplett im
Gratis-Tarif von Vercel, Supabase und Groq.

## Funktionen

- **Buchungen**: Einnahmen/Ausgaben mit Datum, Kategorie, Zahlungsart, Betrag;
  fortlaufende Belegnummern; Suche (inkl. Beleg-Volltext) und Filter nach Jahr/Kategorie.
- **Storno statt Löschen (GoBD)**: Buchungen werden storniert — sie bleiben mit Beleg
  nachvollziehbar, zählen aber in keiner Auswertung mehr mit.
- **Beleg-Scanner**: Kamera öffnen → Belegkanten werden live erkannt → automatischer
  perspektivischer Zuschnitt (Ecken manuell korrigierbar) → Betrag/Datum/Händler/Kategorie
  werden automatisch ausgelesen und vorgeschlagen. PDF-Belege werden über die erste Seite
  ausgelesen; E-Rechnungen (XML) werden als Beleg akzeptiert.
- **Erstattungsanträge**: Teilbarer Link (ohne Login), über den Mitglieder bzw. das Team
  Käufe mit Beleg-Foto einreichen. Prüfen, korrigieren, annehmen (→ automatische
  Ausgabe-Buchung mit verknüpftem Beleg) oder mit Kommentar ablehnen; Status über
  privaten Status-Link.
- **Übersicht**: Kassenbestand über alle Jahre, flexible Zeiträume (30/90 Tage,
  12 Monate, Jahre, frei wählbar), Kategorie-Verteilung; offene Anträge als Badge.
- **Steuererklärung**: pro Jahr Kassenbericht bzw. EÜR als PDF (mit
  Unterschriftszeilen), CSV im Kassenbuch-Format und Komplett-Backup (ZIP mit allen
  Belegen).
- **Einstellungen in der App**: Profil (Verein ↔ Kleinunternehmen), Vereins-/Firmenname,
  Standard-Zeitraum der Übersicht, Standard-Zahlungsart, Duplikat-Warnung, KI-Auslesung
  an/aus, Passwort ändern — Zahnrad oben rechts bzw. „Mehr" am Handy.
- **Kleinunternehmer-Profil**: EÜR-Gruppen an Kategorien, EÜR-Jahresbericht mit
  ELSTER-Ausfüllhilfe statt Kassenbericht, Privatentnahme/-einlage,
  §19-Umsatzgrenzen-Wächter (25.000 € / 100.000 €), angepasste Begriffe. Umschaltbar
  in den Einstellungen; `NEXT_PUBLIC_PROFILE=kleinunternehmen` setzt die Voreinstellung.
- **PWA**: „Zum Startbildschirm hinzufügen" — läuft wie eine App mit eigenem Logo als Icon.

## Setup (einmalig)

### 1. Supabase-Projekt

1. Auf [supabase.com](https://supabase.com) kostenlos registrieren, Projekt anlegen
   (Region Frankfurt).
2. **SQL Editor**: die Migrationen aus [supabase/migrations/](supabase/migrations/) in
   Reihenfolge (0001 bis 0005) ausführen.
3. **Authentication → Settings**: „Allow new users to sign up" deaktivieren.
4. **Authentication → Users**: einen Nutzer (Kassenwart) mit E-Mail/Passwort anlegen.
5. **Project Settings → API**: `Project URL`, `anon public` und `service_role` Key kopieren.

### 2. Groq (kostenlose Beleg-Auslesung)

Auf [console.groq.com](https://console.groq.com) kostenlos registrieren → API Key
erzeugen. Ohne Key fällt die Auslesung automatisch auf lokale Texterkennung
(Tesseract) zurück.

### 3. Umgebungsvariablen

```
NEXT_PUBLIC_SUPABASE_URL=…       # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=…  # anon public Key
GROQ_API_KEY=…                   # Groq (Beleg-Auslesung), nur serverseitig
SUPABASE_SERVICE_ROLE_KEY=…      # service_role (öffentliche Erstattungs-Routen), nur serverseitig
NEXT_PUBLIC_PROFILE=verein       # Voreinstellung; in der App unter „Einstellungen" umschaltbar
VEREIN_NAME=…                    # optionale Voreinstellung; in der App überschreibbar
```

Lokal in `.env.local`, auf Vercel unter Settings → Environment Variables
(Production + Preview). Die beiden Server-Keys niemals mit `NEXT_PUBLIC_` prefixen.

### 4. Lokale Entwicklung / Deployment

```bash
npm install
npm run dev        # http://localhost:3000
```

Deployment: Repo auf GitHub, bei [vercel.com](https://vercel.com) importieren,
Env-Vars setzen. Jeder Push auf `main` deployt automatisch; Feature-Branches bekommen
Preview-URLs (standardmäßig hinter Vercel-Login — bei Bedarf unter Settings →
Deployment Protection deaktivieren).

## Datenschutz-Hinweise

- **Beleg-Auslesung**: Belegbilder werden zur automatischen Auslesung an Groq (USA)
  übertragen. Auf der öffentlichen Einreichungsseite für Mitglieder passiert das nicht —
  dort läuft nur lokale Texterkennung im Browser.
- **IBAN** aus Erstattungsanträgen ist nur für den eingeloggten Kassenwart sichtbar
  (EU-Datenbank, Frankfurt).
- **Belege** liegen in einem privaten Storage-Bucket (EU) und sind nur über kurzlebige
  signierte URLs abrufbar.

## Backup

Der Supabase-Free-Tier hat keine Point-in-Time-Recovery. Da die Daten steuerrelevant
sind: mindestens einmal jährlich den CSV-Export herunterladen und zusammen mit den
Belegen außerhalb von Supabase sichern.

## Betrieb

- **Passwort zurücksetzen**: Supabase → Authentication → Users → Nutzer → Passwort setzen.
- **Keep-Alive**: Ein wöchentlicher Vercel-Cron ([vercel.json](vercel.json) →
  `/api/keepalive`) verhindert, dass das Supabase-Projekt wegen Inaktivität pausiert.
- **Erstattungs-Links** lassen sich unter „Anträge" jederzeit deaktivieren.

## An deinen Verein anpassen

1. **Logo**: eigenes Logo als `public/logo.png` ablegen (PNG, gern hochauflösend),
   dann `node scripts/generate-icons.mjs` ausführen — das erzeugt alle App-Icons
   (PWA + Apple) automatisch daraus.
2. **Name**: „Vereins-Kassenbuch" in [src/app/manifest.ts](src/app/manifest.ts),
   [src/app/layout.tsx](src/app/layout.tsx) und den Layout-Kopfzeilen ersetzen.
3. **Farben**: Primärfarbe und Töne in [src/app/globals.css](src/app/globals.css)
   (`@theme`-Block) anpassen.
4. **Startkategorien**: Liste in
   [src/lib/supabase/seed-categories.ts](src/lib/supabase/seed-categories.ts) ändern.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

Mitgelieferte Drittanbieter-Bibliotheken in `public/`:
[OpenCV.js](https://opencv.org) (Apache-2.0),
[jscanify](https://github.com/ColonelParrot/jscanify) (MIT),
[pdf.js-Worker](https://mozilla.github.io/pdf.js/) (Apache-2.0).
Zur Laufzeit genutzt: [Tesseract.js](https://tesseract.projectnaptha.com) (Apache-2.0).
