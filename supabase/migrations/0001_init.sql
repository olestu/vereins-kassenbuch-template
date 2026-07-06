-- Vereins-Kassenbuch: Schema, Row Level Security, Storage-Policy
-- Ausführen im Supabase SQL Editor (Project -> SQL Editor -> New query)

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  occurred_on date not null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank', 'other')),
  payee text,
  description text,
  receipt_path text,
  ocr_raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_category_idx on public.transactions (category_id);

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- Row Level Security: jeder Nutzer sieht/ändert nur eigene Zeilen
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: privater Bucket für Belege
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "own receipts read" on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own receipts insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own receipts update" on storage.objects
  for update using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own receipts delete" on storage.objects
  for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Startkategorien werden nach dem Anlegen des Nutzers einmalig über die App
-- angelegt (siehe src/lib/supabase/seed-categories.ts), da RLS user_id = auth.uid()
-- voraussetzt und hier noch kein eingeloggter Nutzer im SQL Editor existiert.
