import { connection } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/supabase";

// GET /api/auth/me — who is logged in
export async function GET() {
  await connection();
  try {
    const user = await requireUser();
    return Response.json({ email: user.email ?? "" });
  } catch (err) {
    return errorResponse(err);
  }
}
