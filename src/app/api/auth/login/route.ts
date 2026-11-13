import { authClient, isStaff } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/supabase";

// POST /api/auth/login  { email, password }
// There is deliberately no sign-up route: accounts are created with `npm run user:add`.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password ?? "").slice(0, 200);
    if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

    const supabase = await authClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429) {
        return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
      }
      // Same message for unknown email and wrong password.
      return Response.json({ error: "Wrong email or password." }, { status: 401 });
    }
    if (!isStaff(data.user)) {
      await supabase.auth.signOut({ scope: "local" });
      return Response.json({ error: "This account isn't allowed to use the billing app." }, { status: 403 });
    }
    return Response.json({ email: data.user.email });
  } catch (err) {
    return errorResponse(err);
  }
}
