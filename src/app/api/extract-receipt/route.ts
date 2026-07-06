import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EUER_LINES } from "@/lib/profile";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface ExtractedReceipt {
  betrag: number | null;
  waehrung: string;
  datum: string | null;
  haendler: string;
  mwst_satz: number | null;
  mwst_betrag: number | null;
  kategorie_vorschlag: string;
  /** Offizielle EÜR-Gruppe, wenn keine vorhandene Kategorie passt */
  kategorie_neu: string;
  konfidenz: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY nicht konfiguriert" }, { status: 503 });
  }

  let body: { imageBase64?: string; mime?: string; categories?: { name: string; type: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request" }, { status: 400 });
  }

  const { imageBase64, mime = "image/jpeg", categories = [] } = body;
  if (!imageBase64 || !/^image\/(jpeg|png|webp)$/.test(mime)) {
    return NextResponse.json({ error: "Bild fehlt oder MIME-Typ ungültig" }, { status: 400 });
  }
  // Base64 → Bytes: Länge * 3/4
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Bild zu groß (max. 4 MB)" }, { status: 413 });
  }

  const categoryNames = categories
    .filter((c) => c && typeof c.name === "string")
    .map((c) => c.name)
    .slice(0, 50);

  const prompt = [
    "Du liest deutsche Kassenbons/Belege aus. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Markdown, ohne Erklärung:",
    `{"betrag": 0.00, "waehrung": "EUR", "datum": "YYYY-MM-DD", "haendler": "", "mwst_satz": null, "mwst_betrag": null, "kategorie_vorschlag": "", "kategorie_neu": "", "konfidenz": 0.0}`,
    "Regeln:",
    "- betrag = Gesamtsumme des Belegs als Zahl mit Punkt-Dezimaltrennzeichen; null wenn nicht erkennbar.",
    "- datum = Belegdatum im ISO-Format; null wenn nicht erkennbar.",
    "- haendler = Name des Geschäfts/Ausstellers; leerer String wenn unklar.",
    "- mwst_satz (z.B. 19) und mwst_betrag nur wenn eindeutig ausgewiesen, sonst null.",
    categoryNames.length > 0
      ? `- kategorie_vorschlag MUSS exakt einer dieser Kategorien entsprechen oder leer sein: ${categoryNames.join(", ")}.`
      : `- kategorie_vorschlag: leerer String.`,
    `- kategorie_neu: NUR wenn kategorie_vorschlag leer bleibt, weil keine Kategorie inhaltlich passt: die am besten passende dieser offiziellen Ausgaben-Gruppen, sonst leerer String: ${EUER_LINES.expense.join(", ")}.`,
    "- konfidenz = deine Gesamtsicherheit von 0.0 bis 1.0.",
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => "");
      console.error("Groq error", groqRes.status, detail.slice(0, 500));
      return NextResponse.json({ error: "Auslesung fehlgeschlagen" }, { status: 502 });
    }

    const data = await groqRes.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseExtraction(raw, categoryNames);
    if (!parsed) {
      return NextResponse.json({ error: "Antwort nicht auswertbar" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("extract-receipt failed", err);
    return NextResponse.json({ error: "Auslesung fehlgeschlagen" }, { status: 502 });
  }
}

function parseExtraction(raw: string, validCategories: string[]): ExtractedReceipt | null {
  // Markdown-Fences und Umgebungstext entfernen
  const jsonMatch = raw.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const p = JSON.parse(jsonMatch[0]);
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

    const datum = str(p.datum);
    const kategorie = str(p.kategorie_vorschlag);
    const kategorieNeu = str(p.kategorie_neu);
    const vorschlag = validCategories.includes(kategorie) ? kategorie : "";

    return {
      betrag: num(p.betrag),
      waehrung: str(p.waehrung) || "EUR",
      datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
      haendler: str(p.haendler),
      mwst_satz: num(p.mwst_satz),
      mwst_betrag: num(p.mwst_betrag),
      kategorie_vorschlag: vorschlag,
      // Neue Kategorie nur aus der offiziellen Liste und nur ohne passenden Bestand
      kategorie_neu:
        !vorschlag && EUER_LINES.expense.includes(kategorieNeu) ? kategorieNeu : "",
      konfidenz: Math.min(1, Math.max(0, num(p.konfidenz) ?? 0)),
    };
  } catch {
    return null;
  }
}
