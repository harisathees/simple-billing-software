import "server-only";
import { round2 } from "@/lib/format";
import type { DashboardData, Item } from "@/lib/types";
import { supabase } from "./supabase";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

type Row = { id: number; bill_date: string; total: number; name: string; phone: string; items: Item[] };

/** Dashboard figures over all live (not soft-deleted) bills. `today` = user's local YYYY-MM-DD. */
export async function loadDashboard(today: string): Promise<DashboardData> {
  // Read all live bills in pages of 1000.
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from("bills")
      .select("id,bill_date,total,name,phone,items")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const monthKey = (yy: number, mm: number) => {
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const lastMonth = monthKey(y, m - 1);
  const months = Array.from({ length: 12 }, (_, i) => monthKey(y, m - 11 + i));
  const byMonth = new Map(months.map((k) => [k, { month: k, invoices: 0, amount: 0 }]));

  const sum = { invoices: 0, amount: 0 };
  const tod = { invoices: 0, amount: 0 };
  const cur = { invoices: 0, amount: 0 };
  const prev = { invoices: 0, amount: 0 };
  const customers = new Map<string, { name: string; phone: string; invoices: number; amount: number; last: string }>();
  const products = new Map<string, { product: string; qty: number; amount: number }>();

  for (const b of rows) {
    const total = Number(b.total) || 0;
    const mk = b.bill_date.slice(0, 7);
    sum.invoices++; sum.amount += total;
    if (b.bill_date === today) { tod.invoices++; tod.amount += total; }
    if (mk === thisMonth) { cur.invoices++; cur.amount += total; }
    if (mk === lastMonth) { prev.invoices++; prev.amount += total; }
    const mb = byMonth.get(mk);
    if (mb) { mb.invoices++; mb.amount += total; }

    const key = String(b.phone).replace(/\D/g, "") || b.name.toLowerCase();
    const c = customers.get(key);
    if (!c) customers.set(key, { name: b.name, phone: b.phone, invoices: 1, amount: total, last: b.bill_date });
    else {
      c.invoices++; c.amount += total;
      if (b.bill_date >= c.last) { c.name = b.name; c.last = b.bill_date; }   // latest name wins
    }

    for (const it of Array.isArray(b.items) ? b.items : []) {
      const name = String(it.product ?? "").trim();
      if (!name) continue;
      const k = name.toLowerCase();
      const p = products.get(k) ?? { product: name, qty: 0, amount: 0 };
      p.qty += Number(it.qty) || 0;
      p.amount += Number(it.amount) || 0;
      products.set(k, p);
    }
  }

  const r = (o: { invoices: number; amount: number }) => ({ invoices: o.invoices, amount: round2(o.amount) });
  const data: DashboardData = {
    totals: {
      invoices: sum.invoices,
      amount: round2(sum.amount),
      average: sum.invoices ? round2(sum.amount / sum.invoices) : 0,
      customers: customers.size,
    },
    today: r(tod),
    thisMonth: r(cur),
    lastMonth: r(prev),
    months: months.map((k) => r(byMonth.get(k)!)).map((v, i) => ({ month: months[i], ...v })),
    topCustomers: [...customers.values()]
      .sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map(({ name, phone, invoices, amount }) => ({ name, phone, invoices, amount: round2(amount) })),
    topProducts: [...products.values()]
      .sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map((p) => ({ product: p.product, qty: round2(p.qty), amount: round2(p.amount) })),
  };
  return data;
}
