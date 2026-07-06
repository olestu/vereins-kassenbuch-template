-- Kleinunternehmer-Profil + GoBD-Härtung. Additiv und reversibel.
-- Ausführen im Supabase SQL Editor.

-- Kategorien: Zuordnung zu EÜR-Zeilen(-Gruppen) + Privatentnahme/-einlage-Kennzeichen
alter table public.categories
  add column if not exists euer_line text,
  add column if not exists is_private boolean not null default false;

-- Buchungen: Storno statt Löschen + fortlaufende Belegnummer
alter table public.transactions
  add column if not exists voided_at timestamptz,
  add column if not exists voucher_no integer;

-- Bestehende Buchungen rückwirkend durchnummerieren (chronologisch, pro Nutzer)
with numbered as (
  select id,
         row_number() over (
           partition by user_id
           order by occurred_on, created_at
         ) as rn
  from public.transactions
  where voucher_no is null
)
update public.transactions t
set voucher_no = n.rn
from numbered n
where t.id = n.id;
