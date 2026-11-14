// Builds the invoice PDF and PNG image in the browser. Nothing is uploaded or stored:
// they exist only in memory until downloaded, copied or sent.
import { createRoot } from "react-dom/client";
import InvoiceSheet from "@/components/InvoiceSheet";
import type { Bill, Shop } from "./types";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function waitForImages(root: HTMLElement) {
  return Promise.all([...root.querySelectorAll("img")].map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
}

/** Draw the A4 invoice (off-screen) onto a canvas at 2× resolution. */
async function renderCanvas(bill: Bill, shop: Shop): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<InvoiceSheet bill={bill} shop={shop} />);
    await nextFrame(); await nextFrame();
    await waitForImages(host);
    await document.fonts?.ready;
    const sheet = host.firstElementChild as HTMLElement;
    return await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false });
  } finally {
    root.unmount();
    host.remove();
  }
}

async function canvasToPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const ih = (canvas.height * pw) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.92);
  if (ih <= ph * 1.25) {
    const h = Math.min(ih, ph), w = (pw * h) / ih;        // fit on one page
    pdf.addImage(img, "JPEG", (pw - w) / 2, 0, w, h);
  } else {
    pdf.addImage(img, "JPEG", 0, 0, pw, ih);              // very long bill: extra pages
    for (let y = ph; y < ih - 2; y += ph) { pdf.addPage(); pdf.addImage(img, "JPEG", 0, -y, pw, ih); }
  }
  return pdf.output("blob");
}

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), "image/png"));

// Small in-memory caches so Copy / Download / Share right after View are instant. Any
// change to the bill or the shop details gives a different key, so nothing stale is reused.
const canvases = new Map<string, Promise<HTMLCanvasElement>>();
const pdfs = new Map<string, Promise<Blob>>();
const pngs = new Map<string, Promise<Blob>>();
// Finished files, readable synchronously. Sharing/copying must start *during* the tap
// (phones only allow it for a few seconds after a tap), so we never wait for rendering then.
const ready = new Map<string, Blob>();

function remember<T>(map: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = make();
    p.catch(() => map.delete(key));
    map.set(key, p);
    if (map.size > 20) map.delete(map.keys().next().value!);
  }
  return p;
}

function keepReady(kind: "pdf" | "png", key: string, p: Promise<Blob>) {
  p.then((b) => {
    ready.set(`${kind}:${key}`, b);
    if (ready.size > 40) ready.delete(ready.keys().next().value!);
  }, () => {});
  return p;
}

const keyOf = (bill: Bill, shop: Shop) => JSON.stringify([bill, shop]);
const getCanvas = (bill: Bill, shop: Shop) => remember(canvases, keyOf(bill, shop), () => renderCanvas(bill, shop));

export function getInvoicePdf(bill: Bill, shop: Shop): Promise<Blob> {
  const key = keyOf(bill, shop);
  return remember(pdfs, key, () => keepReady("pdf", key, getCanvas(bill, shop).then(canvasToPdf)));
}

/** The invoice as a PNG image (same rendering as the PDF). */
export function getInvoiceImage(bill: Bill, shop: Shop): Promise<Blob> {
  const key = keyOf(bill, shop);
  return remember(pngs, key, () => keepReady("png", key, getCanvas(bill, shop).then(canvasToPng)));
}

/** Start building both files (call when an invoice is opened). */
export function prepareInvoiceFiles(bill: Bill, shop: Shop) {
  return Promise.all([getInvoicePdf(bill, shop), getInvoiceImage(bill, shop)]);
}

/** Already-built files, or null if they're still being made. */
export const readyPdf = (bill: Bill, shop: Shop) => ready.get(`pdf:${keyOf(bill, shop)}`) ?? null;
export const readyImage = (bill: Bill, shop: Shop) => ready.get(`png:${keyOf(bill, shop)}`) ?? null;

/**
 * Copy the invoice image to the clipboard. Uses the ready image when there is one
 * (most compatible — older Chromium/Samsung Internet don't accept promises here),
 * otherwise the promise (Safari/iOS need the copy to start during the tap).
 * Returns the error name on failure, or null on success.
 */
export async function copyInvoiceImage(bill: Bill, shop: Shop): Promise<string | null> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write || !window.isSecureContext) {
    return "NotSupported";
  }
  if (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png")) return "NotSupported";
  try {
    const img = readyImage(bill, shop) ?? getInvoiceImage(bill, shop);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": img })]);
    return null;
  } catch (err) {
    return (err as Error).name || "Error";
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
