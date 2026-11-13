-- Migration 1: tables, row level security and the logo bucket.
-- Applied with `npm run db:push` (see README). Safe to re-run.
--
-- Security model: Row Level Security is ON and there are NO policies, so the
-- public/anon key can't read or write anything. Only the Next.js server, using
-- SUPABASE_SECRET_KEY from .env.local, can access these tables.

-- ── Shop details (exactly one row, id = 1) ──────────────────────────────
create table if not exists public.shop_settings (
  id          smallint primary key default 1 check (id = 1),
  name        text not null default '',
  slogan      text not null default '',
  address     text not null default '',
  phone       text not null default '',
  email       text not null default '',
  website     text not null default '',
  terms       text not null default '',     -- one condition per line
  logo_path   text,                         -- path inside the logo bucket
  updated_at  timestamptz not null default now()
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;
alter table public.shop_settings enable row level security;

-- ── Bills ───────────────────────────────────────────────────────────────
create table if not exists public.bills (
  id          bigint generated always as identity primary key,
  invoice_no  integer not null unique,
  name        text    not null,                     -- customer name
  bill_date   date    not null,
  address     text    not null default '',
  phone       text    not null,                     -- customer WhatsApp number
  items       jsonb   not null default '[]'::jsonb, -- [{product, qty, rate, amount}]
  total       numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bills_phone_idx on public.bills (phone);
alter table public.bills enable row level security;

-- ── Storage: shop logo only (invoice PDFs are generated, never stored) ──
-- Public bucket so the logo can be shown; only the server can upload/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
