// "Send to WhatsApp": picks the best available way to get the invoice to the customer.
import { api } from "./api";
import { pdfName, waLink, waMessage } from "./format";
import { downloadBlob, getInvoicePdf, prepareInvoiceFiles, readyImage, readyPdf } from "./pdf";
import type { Bill, Shop } from "./types";

export type SendResult = {
  ok: boolean;
  msg: string;
  chatUrl?: string;
  /** The files weren't built yet — open the invoice window and let the user tap again. */
  notReady?: boolean;
};

/** Samsung Internet (default browser on many Samsung phones, and then also inside the
 *  Android app) is reported to fail when sharing PDFs, while images share fine. */
const isSamsungInternet = () => typeof navigator !== "undefined" && /SamsungBrowser/i.test(navigator.userAgent);

export async function sendInvoice(bill: Bill, shop: Shop, cloudApi: boolean): Promise<SendResult> {
  const name = pdfName(bill);
  const text = waMessage(bill, shop.name);

  // 1) WhatsApp Cloud API configured in .env.local → fully automatic.
  if (cloudApi) {
    try {
      const pdf = await getInvoicePdf(bill, shop);
      await api.whatsappSend(bill.id, pdf, name);
      return { ok: true, msg: `Invoice sent to ${bill.name} on WhatsApp.` };
    } catch (err) {
      return { ok: false, msg: `WhatsApp send failed: ${(err as Error).message}` };
    }
  }

  // 2) Phones: the share sheet. A phone only allows it for a few seconds after the tap,
  //    so it must be called straight away — never after building the PDF (slow phones
  //    take longer than that). If the files aren't built yet, build them and ask for
  //    one more tap.
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    const pdf = readyPdf(bill, shop), png = readyImage(bill, shop);
    if (!pdf || !png) {
      prepareInvoiceFiles(bill, shop).catch(() => {});
      return { ok: false, notReady: true, msg: "Preparing the invoice… tap Send to WhatsApp again in a moment." };
    }
    const pdfFile = new File([pdf], name, { type: "application/pdf" });
    const pngFile = new File([png], name.replace(/\.pdf$/, ".png"), { type: "image/png" });
    const candidates = isSamsungInternet() ? [pngFile] : [pdfFile, pngFile];
    const file = candidates.find((f) => navigator.canShare({ files: [f] }));
    if (file) {
      try {
        await navigator.share({ files: [file], title: file.name, text });
        const what = file === pngFile ? "invoice image" : "invoice PDF";
        return { ok: true, msg: `Shared the ${what} — choose ${bill.name}'s chat in WhatsApp if asked.` };
      } catch (err) {
        const e = err as Error;
        if (e.name === "AbortError") return { ok: false, msg: "" };   // user closed the share sheet
        return {
          ok: false,
          msg: `This phone couldn't share the file (${e.name}). Use Download PDF and attach it, or`,
          chatUrl: waLink(bill.phone, text),
        };
      }
    }
    // canShare said no for both → fall through to the download + chat link below.
  }

  // 3) Computers (and phones that can't share files): download the PDF and open this
  //    customer's chat with a message ready. Open the tab before any await so popup
  //    blockers allow it.
  const win = window.open("about:blank", "_blank");
  try {
    const pdf = await getInvoicePdf(bill, shop);
    downloadBlob(pdf, name);
    const url = waLink(bill.phone, text);
    const msg = `PDF downloaded — attach it in ${bill.name}'s WhatsApp chat and press Send.`;
    if (win) {
      win.opener = null;
      win.location.href = url;
      return { ok: true, msg };
    }
    return { ok: true, msg, chatUrl: url };
  } catch (err) {
    win?.close();
    return { ok: false, msg: `Couldn't create the PDF: ${(err as Error).message}` };
  }
}
