import { authClient } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/supabase";

// POST /api/auth/logout — ends this browser's session and clears the cookies.
export async function POST() {
  try {
    const supabase = await authClient();
    await supabase.auth.signOut({ scope: "local" });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
