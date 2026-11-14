// Browser-side wrappers around our own Next.js API routes.
import type { Bill, BillFilters, BillInput, BillsPage, Customer, DashboardData, ProductSuggestion, Shop, ShopInput } from "./types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  // Session expired or logged out in another tab → back to the login page.
  if (res.status === 401 && !url.startsWith("/api/auth/") && typeof window !== "undefined") {
    window.location.replace("/login");
    return new Promise<T>(() => {});   // never resolves; the page is navigating away
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  login: (email: string, password: string) =>
    call<{ email: string }>("/api/auth/login", json("POST", { email, password })),
  logout: () => call<void>("/api/auth/logout", { method: "POST" }),
  me: () => call<{ email: string }>("/api/auth/me"),

  listBills: (p: { q?: string; offset?: number; limit?: number; filters?: BillFilters }, signal?: AbortSignal) => {
    const sp = new URLSearchParams({ offset: String(p.offset ?? 0), limit: String(p.limit ?? 10) });
    if (p.q) sp.set("q", p.q);
    const f = p.filters ?? {};
    if (f.from) sp.set("from", f.from);
    if (f.to) sp.set("to", f.to);
    if (f.min != null) sp.set("min", String(f.min));
    if (f.max != null) sp.set("max", String(f.max));
    if (f.edited) sp.set("edited", "1");
    return call<BillsPage>(`/api/bills?${sp}`, { signal });
  },
  findCustomers: (phone: string, signal?: AbortSignal) =>
    call<Customer[]>(`/api/customers?phone=${encodeURIComponent(phone)}`, { signal }),
  findProducts: (q: string, signal?: AbortSignal) =>
    call<ProductSuggestion[]>(`/api/products?q=${encodeURIComponent(q)}`, { signal }),
  createBill: (b: BillInput) => call<Bill>("/api/bills", json("POST", b)),
  updateBill: (id: number, b: BillInput) => call<Bill>(`/api/bills/${id}`, json("PUT", b)),
  deleteBill: (id: number) => call<void>(`/api/bills/${id}`, { method: "DELETE" }),   // soft delete (internal)

  /** today = the user's local date (YYYY-MM-DD), so "today"/"this month" match their clock. */
  dashboard: (today: string) => call<DashboardData>(`/api/dashboard?today=${encodeURIComponent(today)}`),
  getShop: () => call<Shop>("/api/shop"),
  saveShop: (s: ShopInput) => call<Shop>("/api/shop", json("PUT", s)),
  uploadLogo: (file: Blob) => {
    const fd = new FormData();
    fd.append("file", file, "logo.png");
    return call<Shop>("/api/shop/logo", { method: "POST", body: fd });
  },
  removeLogo: () => call<Shop>("/api/shop/logo", { method: "DELETE" }),

  whatsappStatus: () => call<{ enabled: boolean }>("/api/whatsapp"),
  whatsappSend: (billId: number, pdf: Blob, filename: string) => {
    const fd = new FormData();
    fd.append("billId", String(billId));
    fd.append("file", new File([pdf], filename, { type: "application/pdf" }));
    return call<{ ok: boolean; to: string }>("/api/whatsapp", { method: "POST", body: fd });
  },
};
