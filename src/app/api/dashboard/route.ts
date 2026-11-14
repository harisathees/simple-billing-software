import { connection } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { loadDashboard } from "@/lib/server/dashboard";
import { errorResponse } from "@/lib/server/supabase";

// GET /api/dashboard?today=YYYY-MM-DD — invoice count, total amount, today / this month,
// last 12 months, top customers and products. Live bills only (soft-deleted excluded).
export async function GET(req: Request) {
  await connection();
  try {
    await requireUser();
    const t = new URL(req.url).searchParams.get("today") || "";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : new Date().toISOString().slice(0, 10);
    return Response.json(await loadDashboard(today));
  } catch (err) {
    return errorResponse(err);
  }
}
