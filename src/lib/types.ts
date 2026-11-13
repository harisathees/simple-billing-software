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

export type BillsPage = {
  bills: Bill[];
  total: number;              // matching bills in the database
  nextOffset: number | null;  // null = no more pages
  nextInvoiceNo: number;      // highest invoice no + 1
};

export type Customer = { name: string; phone: string; address: string };

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
