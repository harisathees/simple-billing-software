<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent guide — Billing app

Shop billing app: bills with line items → printable invoice → PDF → WhatsApp.
Next.js 16 (App Router, React 19, TypeScript strict) + Supabase (Postgres + Storage).
User-facing docs are in `README.md`; this file is for coding agents.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (owner usually runs it on port 3001: `npm run dev -- -p 3001`) |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Secret-leak check | `npm run security:scan` (builds, then scans browser output; needs Python 3) |
| DB migrations | `npm run db:push` · `npm run db:status` · `npm run db:new -- <name>` |
| Logins | `npm run user:add -- <email>` · `user:list` · `user:password -- <email>` · `user:remove -- <email>` |

Before finishing any change: `tsc`, `lint` and `build` must pass. Run `security:scan` after
touching env vars, API routes, or anything under `src/lib/server/`.

## Architecture

```
Browser (client components) ──fetch──▶ src/proxy.ts ──▶ /api/* route handlers ──secret key──▶ Supabase
src/components/*, src/lib/{api,pdf,share,format}.ts   (login gate)   src/app/api/**, src/lib/server/*
```

- **The browser never talks to Supabase.** All DB/Storage access goes through
  `src/app/api/**` using the client from `src/lib/server/supabase.ts`.
- `src/lib/server/*` begins with `import "server-only"` — keep it that way; never import
  these files from a component.
- **Auth** (Supabase Auth, email + password, `@supabase/ssr`):
  - `src/proxy.ts` refreshes session cookies and redirects logged-out page requests to
    `/login` (401 JSON for `/api/*`). Public paths: `/login`, `/api/auth/login` only.
  - **Every route handler must call `await requireUser()`** (`src/lib/server/auth.ts`) first,
    inside its `try`. Proxy is only the first gate (Next docs: don't rely on it alone).
  - Only users with `app_metadata.role === "staff"` are allowed. That role is set solely by
    `scripts/users.mjs` with the secret key. There is **no sign-up** — don't add one.
  - Session cookies are `httpOnly`; the publishable key is used server-side only.
  - `src/lib/api.ts` redirects to `/login` on any 401 from a non-auth route.
- Bills: `GET /api/bills?offset&limit&q` is paginated (10 per page, newest `invoice_no`
  first) and searched server-side via the generated `search_text` column. The client
  (`BillingApp.tsx`) keeps a list + `nextOffset` and loads more with an IntersectionObserver.
- Customer lookup: `GET /api/customers?phone=` (uses the generated `phone_digits` column).
- Shop settings: single row `shop_settings.id = 1`. Logo lives in the `shop-assets` bucket
  and is served same-origin via `GET /api/shop/logo?v=<path>` (needed for PDF capture).
- **Invoice PDFs are never stored.** `src/lib/pdf.tsx` renders `InvoiceSheet` off-screen,
  captures it with html2canvas and builds an A4 PDF with jsPDF, cached in memory only.
- WhatsApp (`src/lib/share.ts`): Cloud API if `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
  are set (`/api/whatsapp`, phone number always read from the DB, not the request);
  otherwise the Web Share API, otherwise download + `wa.me` link.

## Rules

### Security
- Secrets (`SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `WHATSAPP_TOKEN`) are server-only;
  `SUPABASE_PUBLISHABLE_KEY` is also kept server-side by design.
  **Never** prefix them with `NEXT_PUBLIC_`, read them in a client component, or return
  them in a response. The only public var is `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE`.
- Never commit `.env.local`. Add new variables to `.env.example` (empty value + comment)
  and to the table in `README.md`.
- Tables have RLS **on with no policies** (only the secret key can access them). Don't
  add permissive policies; if browser-side Supabase access is ever needed, design proper
  policies first.
- Validate and recompute on the server: `parseBill` (`src/lib/server/validate.ts`)
  recomputes every `amount` and the `total` — never trust totals from the client.
- Never create users or store passwords/hashes in SQL migrations — the repo is public.
  Use `npm run user:add`.
- Responses only for logged-in users must not use `Cache-Control: public` (see the logo route).

### Database
- Schema changes go in a **new** file via `npm run db:new -- <name>`; never edit a
  migration that has been pushed. Make migrations re-runnable (`if not exists`,
  `on conflict do nothing`).
- If you add a column the client needs, add it to `BILL_COLUMNS` in
  `src/lib/server/validate.ts` (generated columns like `search_text` stay server-side).

### Next.js 16 specifics (this project)
- `cacheComponents` is enabled: `GET` route handlers must `await connection()` (from
  `next/server`) before reading data, or they get prerendered at build time.
  `export const dynamic = …` is not allowed with Cache Components.
- Route files (`route.ts`) may only export HTTP handlers — put shared constants in `src/lib`.
- Dynamic route params are async: `ctx: RouteContext<"/api/bills/[id]">`, then
  `await ctx.params`.

### React / lint
- eslint-config-next 16 includes React Compiler rules. `react-hooks/set-state-in-effect`
  fails the lint if an effect calls a setter synchronously — set state in a promise
  callback / timer instead (see the loaders in `BillingApp.tsx`).
- Dialogs use `Modal.tsx` (native `<dialog>`); children mount only while open, so forms
  initialise from props with `useState(initial)`. Titles use `DialogHeader` (× close button).

### Invoice / PDF (`InvoiceSheet.tsx` + `.sheet` styles in `globals.css`)
- The sheet is A4 at 96 dpi: **794 × 1123 px**, always light colours (paper), regardless of theme.
- html2canvas limits: inline **SVG and `box-shadow` spread don't render** — the decorative
  corner is nested `<i>` circles for that reason. Use plain `<img>` for the logo.
- After changing the layout, generate a PDF and check it still fits on one page for a
  short bill (`ih <= ph * 1.25` path in `pdf.tsx`).

### UI conventions
- Theme tokens are CSS variables on `:root`; dark overrides live under
  `:root[data-theme="dark"]`. Light is the default; the choice is saved in localStorage
  (`billing-theme`). Use tokens, not hard-coded colours (except inside `.sheet`).
- Phone breakpoint is **720px**: the bills table becomes cards (`.card.bills` rules) with
  "Show more"; `+ New` is the floating `.fab` on phones and `.new-toolbar` on PC.
- Icon-only buttons need `aria-label` and `title`. Icons live in `src/components/icons.tsx`.
- Money is INR via `Intl.NumberFormat("en-IN")`; amounts in words use the Indian system
  (lakh/crore) in `src/lib/format.ts`.
