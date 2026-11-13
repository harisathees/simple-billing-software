import { connection } from "next/server";
import { errorResponse, supabase } from "@/lib/server/supabase";
import { BILL_COLUMNS, normalizeBill, parseBill } from "@/lib/server/validate";
import type { BillsPage } from "@/lib/types";

/** Escape % _ \ so the user's text is matched literally inside ILIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

// GET /api/bills?offset=0&limit=10&q=text — one page, newest invoice first
export async function GET(req: Request) {
  await connection(); // always read live data, never prerender
  try {
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 10));
    const offset = Math.max(0, Math.floor(Number(sp.get("offset")) || 0));
    const q = (sp.get("q") || "").trim().toLowerCase().slice(0, 100);

    const db = supabase();
    let query = db
      .from("bills")
      .select(BILL_COLUMNS, { count: "exact" })
      .order("invoice_no", { ascending: false })
      .range(offset, offset + limit - 1);
    if (q) query = query.ilike("search_text", `%${likeEscape(q)}%`);

    const [{ data, error, count }, top] = await Promise.all([
      query,
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
    const bill = parseBill(await req.json());
    const { data, error } = await supabase().from("bills").insert(bill).select(BILL_COLUMNS).single();
    if (error) throw error;
    return Response.json(normalizeBill(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
