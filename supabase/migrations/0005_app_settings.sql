-- Einstellungen in der App (statt nur über Umgebungsvariablen). Additiv und reversibel.
-- Ausführen im Supabase SQL Editor.

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- null = Voreinstellung aus der Umgebungsvariable NEXT_PUBLIC_PROFILE
  profile text check (profile in ('verein', 'business')),
  -- Name des Vereins / der Firma (Kopfzeile der App und der PDF-Berichte)
  org_name text,
  -- Belege automatisch per Vision-LLM (Groq) auslesen; false = nur lokale Texterkennung
  auto_extract boolean not null default true,
  -- Warnung bei Buchung mit gleichem Betrag und Datum
  duplicate_warning boolean not null default true,
  -- Standard-Zeitraum der Übersicht: alle | 30t | 90t | 12m | jahr
  dashboard_period text not null default 'alle'
    check (dashboard_period in ('alle', '30t', '90t', '12m', 'jahr')),
  -- Vorausgewählte Zahlungsart bei neuen Buchungen
  default_payment text not null default 'cash'
    check (default_payment in ('cash', 'bank', 'other')),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Eigene Einstellungen lesen" on public.app_settings
  for select using (auth.uid() = user_id);

create policy "Eigene Einstellungen anlegen" on public.app_settings
  for insert with check (auth.uid() = user_id);

create policy "Eigene Einstellungen ändern" on public.app_settings
  for update using (auth.uid() = user_id);
