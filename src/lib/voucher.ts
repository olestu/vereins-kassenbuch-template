import type { SupabaseClient } from "@supabase/supabase-js";

/** Nächste fortlaufende Belegnummer (GoBD) des angemeldeten Nutzers (RLS-scoped) */
export async function nextVoucherNo(supabase: SupabaseClient) {
  const { data: last } = await supabase
    .from("transactions")
    .select("voucher_no")
    .order("voucher_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  return ((last?.voucher_no as number | null) ?? 0) + 1;
}
