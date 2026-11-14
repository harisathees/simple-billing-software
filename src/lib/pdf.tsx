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

const keyOf = (bill: Bill, shop: Shop) => JSON.stringify([bill, shop]);
const getCanvas = (bill: Bill, shop: Shop) => remember(canvases, keyOf(bill, shop), () => renderCanvas(bill, shop));

export function getInvoicePdf(bill: Bill, shop: Shop): Promise<Blob> {
  return remember(pdfs, keyOf(bill, shop), () => getCanvas(bill, shop).then(canvasToPdf));
}

/** The invoice as a PNG image (same rendering as the PDF). */
export function getInvoiceImage(bill: Bill, shop: Shop): Promise<Blob> {
  return remember(pngs, keyOf(bill, shop), () => getCanvas(bill, shop).then(canvasToPng));
}

/**
 * Copy the invoice image to the clipboard. The ClipboardItem gets the *promise* of the
 * image, so the copy still counts as part of the tap even if the image takes a moment
 * (Safari/iOS require this). Returns false if this browser can't copy images.
 */
export async function copyInvoiceImage(bill: Bill, shop: Shop): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write || !window.isSecureContext) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": getInvoiceImage(bill, shop) })]);
    return true;
  } catch {
    return false;
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
