export type Item = {
  product: string;
  qty: number;
  rate: number;
  amount: number;
};

export type Bill = {
  id: number;
  invoice_no: number;
  name: string;        // customer name
  bill_date: string;   // YYYY-MM-DD
  address: string;
  phone: string;       // customer WhatsApp number
  items: Item[];
  total: number;
  created_at?: string;
  updated_at?: string;
  /** Soft delete (internal): set when the bill is deleted; such bills are never shown. */
  deleted_at?: string | null;
  deleted_by?: string | null;
};

/** What the form sends to the API. Amounts and total are recomputed on the server. */
export type BillInput = {
  invoice_no: number;
  name: string;
  bill_date: string;
  address: string;
  phone: string;
  items: { product: string; qty: number; rate: number }[];
};

/** Filters for the bills list (all optional). Dates are YYYY-MM-DD (bill date). */
export type BillFilters = {
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  edited?: boolean;
};

export type BillsPage = {
  bills: Bill[];
  total: number;              // matching bills in the database
  nextOffset: number | null;  // null = no more pages
  nextInvoiceNo: number;      // highest invoice no + 1
};

export type Customer = {
  name: string;
  phone: string;
  address: string;
  /** Items and invoice no of this customer's latest bill (to repeat an order quickly). */
  lastItems: { product: string; qty: number; rate: number }[];
  lastInvoiceNo: number | null;
};

/** A product from earlier bills, with the rate and date of the latest bill it was on. */
export type ProductSuggestion = { product: string; rate: number; count: number; lastUsed: string };

export type Shop = {
  name: string;
  slogan: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  terms: string;
  /** Same-origin URL of the logo (via /api/shop/logo), or null. */
  logo_url: string | null;
};

export type ShopInput = Omit<Shop, "logo_url">;

export const EMPTY_SHOP: Shop = {
  name: "", slogan: "", address: "", phone: "", email: "", website: "", terms: "", logo_url: null,
};

/** GET /api/dashboard — totals over all live (not deleted) bills. */
export type DashboardData = {
  totals: { invoices: number; amount: number; average: number; customers: number };
  today: { invoices: number; amount: number };
  thisMonth: { invoices: number; amount: number };
  lastMonth: { invoices: number; amount: number };
  /** Last 12 months, oldest first. month = "YYYY-MM". */
  months: { month: string; invoices: number; amount: number }[];
  topCustomers: { name: string; phone: string; invoices: number; amount: number }[];
  topProducts: { product: string; qty: number; amount: number }[];
};
