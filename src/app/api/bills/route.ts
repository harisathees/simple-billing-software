import { requireUser } from "@/lib/server/auth";
import { connection } from "next/server";
import { errorResponse, supabase } from "@/lib/server/supabase";
import { BILL_COLUMNS, normalizeBill, parseBill } from "@/lib/server/validate";
import type { BillsPage } from "@/lib/types";

/** Escape % _ \ so the user's text is matched literally inside ILIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

// GET /api/bills?offset=0&limit=10&q=text&from=YYYY-MM-DD&to=YYYY-MM-DD&min=100&max=5000&edited=1
// One page of live (not deleted) bills, newest first. All filters are optional.
export async function GET(req: Request) {
  await connection(); // always read live data, never prerender
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 10));
    const offset = Math.max(0, Math.floor(Number(sp.get("offset")) || 0));
    const q = (sp.get("q") || "").trim().toLowerCase().slice(0, 100);
    const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const isAmount = (v: string | null) => (v !== null && v !== "" && Number(v) >= 0 ? Number(v) : null);
    const from = isDate(sp.get("from")), to = isDate(sp.get("to"));
    const min = isAmount(sp.get("min")), max = isAmount(sp.get("max"));
    const edited = sp.get("edited") === "1";

    const db = supabase();
    let query = db
      .from("bills")
      .select(BILL_COLUMNS, { count: "exact" })
      .is("deleted_at", null)                  // soft-deleted bills are never shown
      .order("invoice_no", { ascending: false })
      .range(offset, offset + limit - 1);
    if (q) query = query.ilike("search_text", `%${likeEscape(q)}%`);
    if (from) query = query.gte("bill_date", from);
    if (to) query = query.lte("bill_date", to);
    if (min !== null) query = query.gte("total", min);
    if (max !== null) query = query.lte("total", max);
    if (edited) query = query.eq("is_edited", true);   // needs migration 4

    const [{ data, error, count }, top] = await Promise.all([
      query,
      // Includes deleted bills on purpose: their numbers stay reserved and are never reused.
      db.from("bills").select("invoice_no").order("invoice_no", { ascending: false }).limit(1),
    ]);
    // Asking past the end (e.g. after deletes) isn't an error — it's just an empty page.
    if (error && error.code !== "PGRST103") throw error;
    if (top.error) throw top.error;

    const bills = (data ?? []).map((r) => normalizeBill(r as Record<string, unknown>));
    const total = count ?? 0;
    const page: BillsPage = {
      bills,
      total,
      nextOffset: offset + bills.length < total && bills.length > 0 ? offset + bills.length : null,
      nextInvoiceNo: (top.data?.[0]?.invoice_no ?? 0) + 1,
    };
    return Response.json(page);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/bills — create a bill
export async function POST(req: Request) {
  try {
    await requireUser();
    const bill = parseBill(await req.json());
    const { data, error } = await supabase().from("bills").insert(bill).select(BILL_COLUMNS).single();
    if (error) throw error;
    return Response.json(normalizeBill(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
