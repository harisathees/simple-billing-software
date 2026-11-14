-- Migration 3: soft delete for bills. Applied with `npm run db:push`. Safe to re-run.
--
-- Deleting a bill only sets deleted_at / deleted_by; the row stays in the table and
-- can be restored from "Deleted bills" in the app. The invoice number stays reserved
-- (invoice_no remains unique), so a new bill never reuses a deleted bill's number.

alter table public.bills add column if not exists deleted_at timestamptz;
alter table public.bills add column if not exists deleted_by text;   -- email of who deleted it

-- Fast listing of live bills (newest first) and of the "Deleted bills" view.
create index if not exists bills_live_invoice_idx on public.bills (invoice_no desc) where deleted_at is null;
create index if not exists bills_deleted_at_idx on public.bills (deleted_at desc) where deleted_at is not null;
