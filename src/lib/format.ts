// Formatting helpers shared by the browser and the server.
import type { Bill } from "./types";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const NUM = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n: unknown) => MONEY.format(Number(n) || 0);
export const num = (n: unknown) => NUM.format(Number(n) || 0);
export const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** YYYY-MM-DD -> DD-MM-YYYY */
export function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export const today = () => new Date().toLocaleDateString("en-CA");

/** Indian-system number to words: 125050 -> "One Lakh Twenty Five Thousand Fifty" */
export function numWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : ""));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor(n / 1e5) % 100,
        thousand = Math.floor(n / 1000) % 100, hundred = Math.floor(n / 100) % 10, rest = n % 100;
  if (crore) parts.push(numWords(crore) + " Crore");
  if (lakh) parts.push(two(lakh) + " Lakh");
  if (thousand) parts.push(two(thousand) + " Thousand");
  if (hundred) parts.push(ones[hundred] + " Hundred");
  if (rest) parts.push(two(rest));
  return parts.join(" ");
}

export function rupeesInWords(amount: number) {
  const paiseTotal = Math.round((Number(amount) || 0) * 100);
  const rupees = Math.floor(paiseTotal / 100), paise = paiseTotal % 100;
  return `${numWords(rupees)} Rupees${paise ? " and " + numWords(paise) + " Paise" : ""} Only`;
}

const DEFAULT_CC = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "91";

/** Customer number in international format without "+", e.g. 919876543210. */
export function waNumber(phone: string) {
  let d = digits(phone);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = DEFAULT_CC + d;
  return d;
}

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${waNumber(phone)}` + (text ? `?text=${encodeURIComponent(text)}` : "");

export function pdfName(b: Pick<Bill, "invoice_no" | "name">) {
  const who = String(b.name || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `Invoice-${b.invoice_no}${who ? "-" + who : ""}.pdf`;
}

export function waMessage(b: Bill, shopName: string) {
  return `Hello ${b.name},\n\nThank you for shopping${shopName ? " at " + shopName : ""}! ` +
    `Here is your invoice #${b.invoice_no} dated ${fmtDate(b.bill_date)} for ${money(b.total)}.`;
}
