import { requireUser } from "@/lib/server/auth";
import { connection } from "next/server";
import { errorResponse, supabase } from "@/lib/server/supabase";
import type { Customer, Item } from "@/lib/types";

// GET /api/customers?phone=98765 — past customers whose WhatsApp number contains
// these digits, for the bill form's lookup: latest name/address per number plus the
// items of their latest bill (so picking a customer can fill the products too).
export async function GET(req: Request) {
  await connection();
  try {
    await requireUser();
    const digits = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "").slice(0, 15);
    if (digits.length < 2) return Response.json([]);

    const { data, error } = await supabase()
      .from("bills")
      .select("name,phone,address,phone_digits,invoice_no,items")
      .ilike("phone_digits", `%${digits}%`)
      .is("deleted_at", null)
      .order("bill_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(60);
    if (error) throw error;

    const seen = new Set<string>();
    const customers: Customer[] = [];
    for (const r of data ?? []) {
      if (seen.has(r.phone_digits)) continue;   // newest row per number wins
      seen.add(r.phone_digits);
      const items = (Array.isArray(r.items) ? r.items : []) as Item[];
      customers.push({
        name: r.name,
        phone: r.phone,
        address: r.address ?? "",
        // Product names only — the rate (and qty) are always typed in the new bill.
        lastProducts: [...new Set(items.map((i) => String(i.product ?? "").trim()).filter(Boolean))],
        lastInvoiceNo: r.invoice_no ?? null,
      });
      if (customers.length === 8) break;
    }
    return Response.json(customers);
  } catch (err) {
    return errorResponse(err);
  }
}
