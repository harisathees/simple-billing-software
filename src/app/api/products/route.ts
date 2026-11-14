import { connection } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { errorResponse, supabase } from "@/lib/server/supabase";
import type { Item, ProductSuggestion } from "@/lib/types";

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

// GET /api/products?q=ric — products used in earlier bills that contain the text,
// most-used first, each with the rate from its latest bill.
// Uses the existing search_text column to find candidate bills (no extra table).
export async function GET(req: Request) {
  await connection();
  try {
    await requireUser();
    const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
    if (!q) return Response.json([]);

    const { data, error } = await supabase()
      .from("bills")
      .select("id,bill_date,items")
      .ilike("search_text", `%${likeEscape(q)}%`)
      .order("bill_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (error) throw error;

    const byName = new Map<string, ProductSuggestion & { last: string }>();
    for (const bill of data ?? []) {
      for (const it of (Array.isArray(bill.items) ? bill.items : []) as Item[]) {
        const name = String(it.product ?? "").trim();
        if (!name || !name.toLowerCase().includes(q)) continue;
        const key = name.toLowerCase();
        const seen = byName.get(key);
        if (seen) seen.count++;            // bills are newest first, so the first rate seen is the latest
        else byName.set(key, { product: name, rate: Number(it.rate) || 0, count: 1, last: bill.bill_date });
      }
    }

    const list = [...byName.values()]
      .sort((a, b) => {
        // names starting with the typed text first, then most used, then most recent
        const sa = a.product.toLowerCase().startsWith(q) ? 0 : 1;
        const sb = b.product.toLowerCase().startsWith(q) ? 0 : 1;
        return sa - sb || b.count - a.count || b.last.localeCompare(a.last);
      })
      .slice(0, 8)
      .map(({ product, rate, count }) => ({ product, rate, count }));
    return Response.json(list);
  } catch (err) {
    return errorResponse(err);
  }
}
