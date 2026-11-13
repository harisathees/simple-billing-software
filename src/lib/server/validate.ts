import "server-only";
import { round2 } from "@/lib/format";
import type { Bill, Item, ShopInput } from "@/lib/types";
import { BadRequest } from "./supabase";

/** Columns sent to the browser (the generated search columns stay on the server). */
export const BILL_COLUMNS = "id,invoice_no,name,bill_date,address,phone,items,total,created_at,updated_at";

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);

/** Validate a bill from the client and recompute every amount on the server. */
export function parseBill(body: unknown): Omit<Bill, "id" | "created_at" | "updated_at"> {
  const b = (body ?? {}) as Record<string, unknown>;

  const invoice_no = Number(b.invoice_no);
  if (!Number.isInteger(invoice_no) || invoice_no < 1) throw new BadRequest("Invoice No must be a whole number.");

  const name = str(b.name, 120);
  if (!name) throw new BadRequest("Customer name is required.");

  const phone = str(b.phone, 20);
  if (!/^[0-9+\-\s]{7,20}$/.test(phone)) throw new BadRequest("Enter a valid WhatsApp number.");

  const bill_date = str(b.bill_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bill_date)) throw new BadRequest("Enter a valid date.");

  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: Item[] = rawItems.slice(0, 200).map((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const product = str(it.product, 200);
    const qty = Number(it.qty);
    const rate = Number(it.rate);
    if (!product) throw new BadRequest(`Item ${i + 1}: product is required.`);
    if (!(qty > 0)) throw new BadRequest(`Item ${i + 1}: quantity must be more than 0.`);
    if (!(rate >= 0)) throw new BadRequest(`Item ${i + 1}: rate can't be negative.`);
    return { product, qty, rate: round2(rate), amount: round2(qty * rate) };
  });
  if (!items.length) throw new BadRequest("Add at least one item.");

  const total = round2(items.reduce((s, i) => s + i.amount, 0));
  return { invoice_no, name, phone, bill_date, address: str(b.address, 500), items, total };
}

export function parseShop(body: unknown): ShopInput {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    name: str(b.name, 120),
    slogan: str(b.slogan, 200),
    address: str(b.address, 500),
    phone: str(b.phone, 40),
    email: str(b.email, 120),
    website: str(b.website, 200),
    terms: str(b.terms, 2000),
  };
}

export function normalizeBill(row: Record<string, unknown>): Bill {
  return {
    ...(row as unknown as Bill),
    address: String(row.address ?? ""),
    items: Array.isArray(row.items) ? (row.items as Item[]) : [],
    total: Number(row.total) || 0,
  };
}
