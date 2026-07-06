import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin-Client mit service_role — umgeht RLS. Ausschließlich in den
 * öffentlichen Server-Routen (/einreichen, /antrag, /api/public) verwenden,
 * dort immer mit strikter Token-Validierung. Der "server-only"-Import
 * verhindert, dass dieser Code je ins Client-Bundle gelangt.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert");

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
