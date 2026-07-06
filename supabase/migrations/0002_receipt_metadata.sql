-- Beleg-Metadaten + strukturierte Auslese-Daten an Buchungen.
-- Additiv und reversibel; bestehende Spalten (receipt_path, ocr_raw_text) bleiben unverändert.
-- Ausführen im Supabase SQL Editor.

alter table public.transactions
  add column if not exists receipt_filename text,
  add column if not exists receipt_size_bytes integer,
  add column if not exists receipt_mime text,
  add column if not exists extracted_data jsonb;
