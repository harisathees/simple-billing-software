# Billing

A small billing app for a shop: create bills with multiple items, see them as a
printable invoice, download the invoice as a PDF, and send it to the customer on WhatsApp.

- **Next.js 16** (App Router) + **Supabase** (Postgres + Storage)
- Bills and shop details are stored in Supabase; the **shop logo** is stored in a Supabase Storage bucket
- **Invoice PDFs are never stored** — they're generated in the browser when you view, download or share
- **Login with Supabase Auth** — no public sign-up; the owner creates staff logins from the terminal
- Light / dark theme, phone-friendly layout, search, and infinite scroll (10 bills at a time)
- **Installable app (PWA)** and ready for **Bubblewrap** to build an Android **APK / AAB**

---

## 1. Requirements

- Node.js 20 or newer (`node -v`)
- A Supabase project (the free plan is enough)
- Python 3 — only for `npm run security:scan`

## 2. Install

```bash
cd billing-next
npm install
```

## 3. Configure `.env.local`

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Needed for |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API Keys (project URL) | the app |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_…`) or the legacy `service_role` key | the app |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) or the legacy `anon` key | login |
| `SUPABASE_DB_URL` | Supabase → **Connect** (top bar) → **Session pooler** → URI, with your database password filled in | migrations only |
| `SUPABASE_LOGO_BUCKET` | leave as `shop-assets` | the app |
| `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` | `91` for India — added to 10-digit WhatsApp numbers | the app |
| `APP_NAME`, `APP_SHORT_NAME` | name under the installed app icon (default "Billing") | PWA / APK |
| `TWA_PACKAGE_NAME`, `TWA_SHA256_FINGERPRINTS` | from Bubblewrap, see [Android app](#10-android-app-apk-with-bubblewrap) | APK |
| `WHATSAPP_*` | optional, see [WhatsApp sending](#8-whatsapp-sending) | auto-send |

> **Never** rename a secret to start with `NEXT_PUBLIC_` — those values are copied into
> the browser bundle. `.env.local` is git-ignored, so it won't be committed.

If your database password has special characters (`@ : / ? # %`), URL-encode them in
`SUPABASE_DB_URL` (e.g. `@` → `%40`).

## 4. Create the database (migrations)

The database is managed with **Supabase CLI migrations** (the CLI is installed as a dev
dependency — nothing to install globally). Migrations live in `supabase/migrations/` and run
in filename order:

| File | What it does |
|---|---|
| `20261113000000_init.sql` | `shop_settings` and `bills` tables, Row Level Security, `shop-assets` logo bucket |
| `20261113000100_search_and_paging.sql` | `phone_digits` and `search_text` columns used for search and customer lookup |

Apply everything that hasn't been applied yet:

```bash
npm run db:push
```

See which migrations are already applied:

```bash
npm run db:status
```

Both migrations are written to be safe to re-run (`if not exists` / `on conflict do nothing`),
so `db:push` also works on a database where you already ran the SQL by hand — it just
records them as applied.

### Changing the database later

1. Create a new, empty migration file:
   ```bash
   npm run db:new -- add_gst_number
   ```
   This creates `supabase/migrations/<timestamp>_add_gst_number.sql`.
2. Write your SQL in that file, e.g.
   ```sql
   alter table public.bills add column if not exists gst_number text not null default '';
   ```
3. Apply it:
   ```bash
   npm run db:push
   ```

Never edit a migration that has already been pushed — add a new one instead.

## 5. Create logins

There is **no sign-up page**. Only the owner can create accounts, from the project folder:

```bash
npm run user:add -- owner@myshop.com        # asks for the password (hidden, min 8 chars)
npm run user:list                            # who can log in, last sign-in
npm run user:password -- owner@myshop.com    # change a password
npm run user:remove -- staff@myshop.com      # delete a login
```

- No confirmation email is sent — the account works immediately.
- Passwords are typed at a hidden prompt and are **never saved in any file** (that's why logins
  aren't created in a SQL migration: migrations are committed to git).
- Only accounts created this way are marked `staff` (`app_metadata.role`, which users can't
  change themselves). Any other Supabase account is refused, even with a correct password.

**Recommended:** also turn off public sign-ups in Supabase → **Authentication → Sign In /
Providers → "Allow new users to sign up"** → off. The app already refuses non-staff accounts;
this stops such accounts being created at all.

### Is Supabase Auth free?

Yes for this app. The Free plan includes **50,000 monthly active users** at $0
([pricing](https://supabase.com/pricing)). Things to know:

- Supabase's built-in email sender is limited to **2 emails per hour**
  ([rate limits](https://supabase.com/docs/guides/auth/rate-limits)). This app doesn't send
  any auth emails (no sign-up, no confirmation), so it isn't affected. Password-reset emails
  would need a custom SMTP server; use `npm run user:password` instead.
- Password logins are rate-limited per IP (150 per 5 minutes by default).
- Free projects **pause after 1 week without activity** — un-pause from the dashboard.

## 6. Run

```bash
npm run dev            # development  → http://localhost:3000
npm run dev -- -p 3001 # on another port
```

Production:

```bash
npm run build
npm start
```

Open the app, **sign in** with a login from step 5, then click the **⚙** icon and fill in your
shop details and logo. They appear in the header and on every invoice. The logout icon (top right) signs you out.

## 7. Using the app

| Action | PC | Phone |
|---|---|---|
| New bill | **+ New** (right side, above the table) | floating **+ New** button (bottom right) |
| View invoice / PDF | 👁 icon | 👁 icon |
| Edit bill | ✏ icon | ✏ icon |
| Send PDF on WhatsApp | green **Share** button | green **Share** button |
| Delete | 🗑 icon | 🗑 icon |
| More details | always shown in the table | **Show more ⌄** on each card |

- **Search** matches invoice number, customer name, WhatsApp number, address and products.
- Bills load **10 at a time**, newest first; more load automatically as you scroll.
- In the bill form, typing a WhatsApp number shows past customers; picking one fills the
  name and address.
- The **🌙 / ☀** icon switches between light (default) and dark theme.

## 8. WhatsApp sending

Without extra setup, **Send to WhatsApp / Share** works like this:

- **Phone (site on https):** opens the share sheet with the PDF attached → pick WhatsApp → pick the chat.
- **Computer:** downloads the PDF and opens the customer's WhatsApp chat with a message ready
  → attach the PDF → Send.

**Fully automatic sending (optional):** with a Meta WhatsApp Business (Cloud API) account, fill
in `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. The app then uploads the generated PDF straight
to WhatsApp and sends it — still without storing it in Supabase. To message customers who
haven't written to you in the last 24 hours, WhatsApp requires an approved template with a
**document header** (`WHATSAPP_TEMPLATE_NAME`). The body variables it fills are
`{{1}}` customer name, `{{2}}` invoice no, `{{3}}` total (set `WHATSAPP_TEMPLATE_BODY_PARAMS=false`
if your template has none).

## 9. Install as an app (PWA)

When the site is served over **HTTPS**, browsers offer to install it:

- **Android (Chrome):** menu ⋮ → **Install app** (or "Add to Home screen").
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **PC (Chrome/Edge):** install icon in the address bar.

It opens full-screen with its own icon. Long-press the icon for the **New bill** shortcut.

What's included: `src/app/manifest.ts` (→ `/manifest.webmanifest`), icons in `public/icons/`
(normal + *maskable* for Android's round/squircle masks), and a service worker `public/sw.js`
that caches **only** the app's static files and shows `public/offline.html` with no connection.
Bills and customer data are **never** cached on the device — they always come from the server.

> The service worker only runs in production (`npm run build && npm start`), not in `npm run dev`.

## 10. Android app (APK) with Bubblewrap

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) wraps the PWA in a
Trusted Web Activity: a real Android app (APK for sideloading, AAB for Google Play) that
shows the site full-screen with no address bar.

**Requirements:** the app must be **deployed on a public HTTPS address** (e.g. Vercel, Netlify,
your own server) — Bubblewrap can't use `localhost`. Bubblewrap downloads a JDK and the Android
SDK the first time it runs.

1. **Deploy** the app with all `.env.local` values set on the host (except `SUPABASE_DB_URL`,
   which is only for migrations).
   - **Netlify:** `netlify.toml` tells Netlify's secret scanner to skip the variables that
     aren't secret (`APP_NAME`, `SUPABASE_LOGO_BUCKET`, `TWA_*`, …). Without it the build fails
     with "Secrets scanning found secrets in build", because e.g. the value `Billing` appears in
     the code. Your real keys are still scanned.
2. **Create the Android project** (inside this repo, in `android/`, which is git-ignored except
   `twa-manifest.json`):
   ```bash
   npm i -g @bubblewrap/cli
   bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest --directory android
   ```
   Answer the questions — choose a package name such as `com.yourshop.billing`, and let it
   **create a new signing key**. Keep the keystore file and its passwords safe and **never commit
   them** (`*.keystore`, `*.jks` are git-ignored). Losing the key means you can't update the app.
3. **Build:**
   ```bash
   cd android
   bubblewrap build
   ```
   You get `app-release-signed.apk` (install on phones) and `app-release-bundle.aab` (Google Play).
4. **Link the app to the site (removes the address bar).** Get the key's SHA-256 fingerprint:
   ```bash
   keytool -list -v -keystore android.keystore -alias android   # or: bubblewrap fingerprint list
   ```
   Set these on your host and redeploy:
   ```
   TWA_PACKAGE_NAME=com.yourshop.billing
   TWA_SHA256_FINGERPRINTS=AB:CD:...:EF
   ```
   Check that `https://YOUR-DOMAIN/.well-known/assetlinks.json` shows your package and fingerprint.
   If you publish on Google Play with *Play App Signing*, also add Play's **app signing key**
   fingerprint (Play Console → Setup → App integrity), comma-separated.
5. **Install** on a phone: copy the APK over, or `adb install app-release-signed.apk`.

If the app opens with a browser address bar at the top, the assetlinks check failed — re-check
the package name and fingerprint, then clear Chrome's data on the phone and reopen the app.

**In the APK:** login works the same (cookies live in Chrome on the phone), and
**Send to WhatsApp / Share** opens Android's share sheet with the **PDF attached** — pick WhatsApp
and the customer's chat.

When you change the app's name, icons or colours, run `bubblewrap update` then `bubblewrap build`
again (and bump the version when asked) so installed apps pick up the change.

## 11. Security

- **Login required everywhere.** `src/proxy.ts` sends logged-out visitors to `/login`, and
  every API route also calls `requireUser()` itself, so the data can't be reached without a
  valid staff session — not even by calling the API directly.
- Sessions are kept in **httpOnly cookies** set by the server (JavaScript in the page can't read
  them) and are verified with Supabase on each request, so a forged cookie is rejected.
- **Row Level Security is on with no policies** on both tables: the public/anon key can't read
  or write anything.
- Only the Next.js server (`src/app/api/*`) talks to Supabase, using `SUPABASE_SECRET_KEY`.
  The browser only ever calls `/api/*` and never sees the key or the Supabase URL.
- Server files in `src/lib/server/` start with `import "server-only"`, so the build fails if a
  browser component ever imports them by mistake.
- The logo bucket is public-read (so the logo can be shown) and server-write only.

Check that no secret ended up in the browser build:

```bash
npm run security:scan
```

It builds the app, then searches every browser file (`.next/static`, `public/`, prerendered
pages) and the live API responses of the running app for the values in `.env.local`. It prints
**where** something was found, never the value. Run it again whenever you add a new secret.

> Before putting it online: use HTTPS (cookies are marked `Secure` in production), and turn
> off public sign-ups in Supabase as described in step 5.

## 12. Project structure

```
src/
  app/
    api/bills/            GET (paged + search), POST
    api/bills/[id]/       PUT, DELETE
    api/customers/        lookup by WhatsApp number
    api/shop/             shop details (GET, PUT)
    api/shop/logo/        logo upload / delete / serve
    api/whatsapp/         optional Cloud API sending
    api/auth/             login, logout, me
    login/                sign-in page
    manifest.ts           PWA manifest (/manifest.webmanifest)
    .well-known/assetlinks.json/  Android app ↔ site link (from TWA_* env vars)
    layout.tsx, page.tsx, globals.css
  components/             BillingApp, BillsTable, BillFormDialog, InvoiceDialog,
                          InvoiceSheet (invoice design), SettingsDialog, ThemeToggle, …
  lib/
    server/               Supabase client, auth (requireUser), validation (server-only)
    api.ts                browser → /api calls
    pdf.tsx               PDF generation (html2canvas + jsPDF)
    share.ts              WhatsApp send logic
    format.ts             money, dates, amount in words
supabase/migrations/      database migrations
src/proxy.ts              login gate for every page and API request
scripts/db.mjs            npm run db:push / db:status / db:new
scripts/users.mjs         npm run user:add / user:list / user:password / user:remove
public/sw.js              service worker (static files only, offline page)
public/icons/             app icons (normal + maskable) and shortcut icon
scripts/security-scan.py  npm run security:scan
```

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | start the dev server |
| `npm run build` / `npm start` | production build / run it |
| `npm run lint` | ESLint |
| `npm run db:push` | apply new migrations to Supabase |
| `npm run db:status` | list applied migrations |
| `npm run db:new -- <name>` | create a new migration file |
| `npm run user:add -- <email>` | create a login (password asked at a hidden prompt) |
| `npm run user:list` | list logins |
| `npm run user:password -- <email>` | change a password |
| `npm run user:remove -- <email>` | delete a login |
| `npm run security:scan` | build and check that no secrets reach the browser |
