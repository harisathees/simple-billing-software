import { connection } from "next/server";
import { errorResponse, supabase } from "@/lib/server/supabase";
import type { Customer } from "@/lib/types";

// GET /api/customers?phone=98765 — past customers whose WhatsApp number contains
// these digits (latest name/address per number), for the bill form's lookup.
export async function GET(req: Request) {
  await connection();
  try {
    const digits = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "").slice(0, 15);
    if (digits.length < 2) return Response.json([]);

    const { data, error } = await supabase()
      .from("bills")
      .select("name,phone,address,phone_digits")
      .ilike("phone_digits", `%${digits}%`)
      .order("bill_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(60);
    if (error) throw error;

    const seen = new Set<string>();
    const customers: Customer[] = [];
    for (const r of data ?? []) {
      if (seen.has(r.phone_digits)) continue;   // newest row per number wins
      seen.add(r.phone_digits);
      customers.push({ name: r.name, phone: r.phone, address: r.address ?? "" });
      if (customers.length === 8) break;
    }
    return Response.json(customers);
  } catch (err) {
    return errorResponse(err);
  }
}
