import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Statische Dateien (Bilder, Skripte wie /opencv/*, /sw.js, PDF-Worker, Manifest)
  // laufen NICHT durch die Auth-Prüfung — sonst bekommt z.B. der Beleg-Scanner auf
  // der öffentlichen Einreichen-Seite statt OpenCV einen Redirect zur Login-Seite.
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|mjs|wasm|map|txt|xml)$).*)",
  ],
};
