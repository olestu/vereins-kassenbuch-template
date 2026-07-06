import { NextResponse } from "next/server";

// Wird wöchentlich von Vercel Cron aufgerufen (siehe vercel.json), damit das
// Supabase-Free-Tier-Projekt nicht wegen Inaktivität pausiert wird.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: "Supabase env vars fehlen" }, { status: 500 });
  }

  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anonKey },
  });

  return NextResponse.json({ ok: res.ok });
}
