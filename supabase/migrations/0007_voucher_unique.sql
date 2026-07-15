-- Belegnummern gegen Doppelvergabe absichern (GoBD: fortlaufend und eindeutig).
-- Vorher wurden bei exakt gleichzeitigen Buchungen (zwei Geräte/Nutzer-Sessions)
-- vereinzelt doppelte Nummern vergeben. Ausführen im Supabase SQL Editor.

-- Buchungen aus angenommenen Erstattungsanträgen hatten bisher keine Nummer:
-- rückwirkend chronologisch ans Ende der jeweiligen Nutzer-Sequenz anhängen
with numbered as (
  select id,
         (select coalesce(max(voucher_no), 0) from public.transactions t2
            where t2.user_id = t.user_id)
         + row_number() over (partition by user_id order by created_at) as new_no
  from public.transactions t
  where voucher_no is null
)
update public.transactions t
set voucher_no = n.new_no
from numbered n
where t.id = n.id;

-- Ab jetzt kann dieselbe Nummer pro Nutzer nie doppelt vergeben werden;
-- die App fängt den Konflikt ab und vergibt automatisch die nächste Nummer.
create unique index if not exists transactions_user_voucher_unique
  on public.transactions (user_id, voucher_no);
