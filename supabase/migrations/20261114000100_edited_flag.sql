-- Migration 4: is_edited flag for the "Edited bills only" filter. Applied with
-- `npm run db:push` (or paste into Supabase → SQL Editor). Safe to re-run.
--
-- A bill counts as edited once it has been updated after it was first saved:
-- on insert created_at = updated_at; every edit (PUT /api/bills/:id) sets updated_at.
-- Postgres keeps this column up to date automatically.

alter table public.bills
  add column if not exists is_edited boolean
  generated always as (updated_at > created_at) stored;

-- Filters on bill date and total (live bills only).
create index if not exists bills_live_date_idx on public.bills (bill_date) where deleted_at is null;
create index if not exists bills_live_total_idx on public.bills (total) where deleted_at is null;
