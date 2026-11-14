import { connection } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { errorResponse, supabase } from "@/lib/server/supabase";
import type { Item, ProductSuggestion } from "@/lib/types";

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

// GET /api/products?q=ric — products from earlier bills, MOST RECENTLY USED FIRST,
// each with the rate from the latest bill it appeared on. With no q, returns the
// most recently billed products (shown when an empty Product box is tapped).
// Uses the existing search_text column to find candidate bills (no extra table).
export async function GET(req: Request) {
  await connection();
  try {
    await requireUser();
    const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);

    let query = supabase()
      .from("bills")
      .select("id,bill_date,items")
      .is("deleted_at", null)
      .order("bill_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(q ? 300 : 50);
    if (q) query = query.ilike("search_text", `%${likeEscape(q)}%`);
    const { data, error } = await query;
    if (error) throw error;

    // Bills come newest first, so the first time a product is seen is its most recent use.
    const byName = new Map<string, ProductSuggestion>();
    for (const bill of data ?? []) {
      for (const it of (Array.isArray(bill.items) ? bill.items : []) as Item[]) {
        const name = String(it.product ?? "").trim();
        if (!name || (q && !name.toLowerCase().includes(q))) continue;
        const key = name.toLowerCase();
        const seen = byName.get(key);
        if (seen) seen.count++;
        else byName.set(key, { product: name, rate: Number(it.rate) || 0, count: 1, lastUsed: bill.bill_date });
      }
    }

    // Map keeps insertion order = most recent first.
    return Response.json([...byName.values()].slice(0, 8));
  } catch (err) {
    return errorResponse(err);
  }
}
