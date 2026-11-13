import "server-only";
// Login with Supabase Auth. Sessions live in httpOnly cookies set by the server,
// so browser JavaScript never sees the tokens. Only accounts created with
// `npm run user:add` (app_metadata.role = "staff") may use the app.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ConfigError } from "./supabase";

export const STAFF_ROLE = "staff";

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** app_metadata can only be changed with the secret key (never by the user). */
export const isStaff = (u: User | null | undefined) => u?.app_metadata?.role === STAFF_ROLE;

export class Unauthorized extends Error {
  status = 401;
}

export function authEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ConfigError(
      "Login is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env.local and restart the server.",
    );
  }
  return { url, key };
}

/** Supabase client bound to this request's cookies (create one per request). */
export async function authClient() {
  const { url, key } = authEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a context that can't set cookies; the proxy refreshes them instead.
        }
      },
    },
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });
}

/** Call at the top of every API route. Throws 401 unless a staff user is logged in. */
export async function requireUser(): Promise<User> {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser(); // verified with Supabase, not just decoded
  if (error || !isStaff(data.user)) throw new Unauthorized("Please log in.");
  return data.user!;
}
