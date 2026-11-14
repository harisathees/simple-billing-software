import "server-only";
// Server-only Supabase client. Imported only by files under src/app/api,
// so SUPABASE_SECRET_KEY never reaches the browser bundle.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ConfigError extends Error {}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new ConfigError(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local and restart the server.",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || "shop-assets";

/** Turn any thrown error into a JSON response with a sensible status code. */
export function errorResponse(err: unknown) {
  if (err instanceof ConfigError) return Response.json({ error: err.message }, { status: 503 });
  if ((err as { status?: number })?.status === 401) {
    return Response.json({ error: "Please log in." }, { status: 401 });
  }
  const e = err as { code?: string; message?: string; status?: number };
  if (e?.code === "23505") {
    return Response.json(
      { error: "That Invoice No is already used. Each invoice number can only be used once." },
      { status: 409 },
    );
  }
  if (e?.code === "PGRST116") return Response.json({ error: "Not found." }, { status: 404 });
  if (e?.code === "42703" || (e?.code === "PGRST204") || /search_text|phone_digits|is_edited|deleted_at/.test(e?.message || "")) {
    return Response.json(
      { error: "Database needs an update. Run `npm run db:push` (see README)." },
      { status: 500 },
    );
  }
  if (e?.code === "42P01" || e?.code === "PGRST205") {
    return Response.json(
      { error: "Database tables are missing. Run `npm run db:push` (see README)." },
      { status: 500 },
    );
  }
  console.error(err);
  return Response.json({ error: e?.message || "Something went wrong." }, { status: e?.status || 500 });
}

export class BadRequest extends Error {
  status = 400;
}
