-- Migration 2: search + paging. Applied with `npm run db:push`. Safe to re-run.
-- Adds two columns that Postgres keeps up to date automatically, used for
-- server-side search and for looking up customers by WhatsApp number.

-- Digits only, e.g. "+91 98765-43210" -> "919876543210"
alter table public.bills
  add column if not exists phone_digits text
  generated always as (regexp_replace(phone, '\D', '', 'g')) stored;

-- Everything searchable in one lower-case string (invoice no, customer, phone,
-- address and product names inside the items JSON).
alter table public.bills
  add column if not exists search_text text
  generated always as (
    lower(
      invoice_no::text || ' ' || name || ' ' || phone || ' ' ||
      regexp_replace(phone, '\D', '', 'g') || ' ' || coalesce(address, '') || ' ' || items::text
    )
  ) stored;

