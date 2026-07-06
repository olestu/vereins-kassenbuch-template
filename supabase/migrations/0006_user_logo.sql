-- Eigenes Logo pro Nutzer (Pfad im privaten receipts-Bucket unter {uid}/branding/).
-- Additiv und reversibel. Ausführen im Supabase SQL Editor.

alter table public.app_settings
  add column if not exists logo_path text;
