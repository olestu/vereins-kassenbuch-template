import { createBrowserClient } from "@supabase/ssr";

// Bewusst ohne generisches Database-Typing: die postgrest-js-Generics für
// insert()/update() sind zu fragil für ein handgeschriebenes Schema ohne
// `supabase gen types`. Lese-/Schreibzugriffe werden stattdessen explizit
// gegen die Domain-Typen in @/lib/types gecastet.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
