-- Erstattungsanträge: geteilte Einreichungs-Links + Anträge von Mitgliedern ohne Account.
-- Additiv; öffentlicher Zugriff läuft ausschließlich über Server-Routen mit service_role —
-- deshalb KEINE anon-Policies. RLS gibt nur dem Kassenwart (Owner) Zugriff.

create table public.reimbursement_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique,
  label text,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.reimbursement_links(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status_token text not null unique,
  submitter_name text not null,
  submitter_contact text,
  amount_cents integer not null check (amount_cents > 0),
  occurred_on date not null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  iban text,
  receipt_path text,
  extracted_data jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  review_comment text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index reimbursement_requests_owner_status_idx
  on public.reimbursement_requests (owner_user_id, status);
-- Für das Rate-Limit (Einreichungen pro Link pro Stunde)
create index reimbursement_requests_link_created_idx
  on public.reimbursement_requests (link_id, created_at desc);

alter table public.reimbursement_links enable row level security;
alter table public.reimbursement_requests enable row level security;

create policy "own links" on public.reimbursement_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own requests" on public.reimbursement_requests
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
