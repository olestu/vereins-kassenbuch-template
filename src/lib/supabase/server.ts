import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSettings, type AppSettings } from "@/lib/settings";

// Bewusst ohne generisches Database-Typing, siehe lib/supabase/client.ts.
// cache(): ein Client pro Request — Layout, Seite und Routen teilen die Instanz.
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll wird aus einer Server Component aufgerufen; das ist ok,
            // solange middleware.ts die Session ohnehin refresht.
          }
        },
      },
    },
  );
});

/** Einstellungen einmal pro Request laden — Layout und Seiten teilen das Ergebnis. */
export const getCachedSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  return getSettings(supabase);
});
