// Builds the invoice PDF in the browser. Nothing is uploaded or stored:
// the PDF exists only in memory until it's downloaded or sent.
import { createRoot } from "react-dom/client";
import InvoiceSheet from "@/components/InvoiceSheet";
import type { Bill, Shop } from "./types";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function waitForImages(root: HTMLElement) {
  return Promise.all([...root.querySelectorAll("img")].map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
}

async function renderPdf(bill: Bill, shop: Shop): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Render the invoice off-screen at full A4 size.
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
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false });

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
  } finally {
    root.unmount();
    host.remove();
  }
}

// Small in-memory cache so Share right after View is instant. Any change to the
// bill or the shop details produces a different key, so stale PDFs are never reused.
const cache = new Map<string, Promise<Blob>>();

export function getInvoicePdf(bill: Bill, shop: Shop): Promise<Blob> {
  const key = JSON.stringify([bill, shop]);
  let p = cache.get(key);
  if (!p) {
    p = renderPdf(bill, shop);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 20) cache.delete(cache.keys().next().value!);
  }
  return p;
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
