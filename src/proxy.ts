// Runs before every page and API request (Next.js 16 "proxy", formerly middleware):
// refreshes the login session cookies and keeps logged-out visitors on /login.
// API routes also check the login themselves (requireUser) — this is the first gate.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS, isStaff } from "@/lib/server/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next(); // the app shows the setup message

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });

  const { data } = await supabase.auth.getUser();
  const loggedIn = isStaff(data.user);
  const { pathname } = request.nextUrl;

  if (!loggedIn && !PUBLIC_PATHS.has(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (loggedIn && pathname === "/login") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Everything except Next.js assets and static image files.
  // PWA/Android files are public too: manifest, service worker, offline page, assetlinks.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|\\.well-known/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
