// "Send to WhatsApp": picks the best available way to get the PDF to the customer.
import { api } from "./api";
import { pdfName, waLink, waMessage } from "./format";
import { downloadBlob, getInvoicePdf } from "./pdf";
import type { Bill, Shop } from "./types";

export type SendResult = { ok: boolean; msg: string; chatUrl?: string };

export async function sendInvoice(bill: Bill, shop: Shop, cloudApi: boolean): Promise<SendResult> {
  const name = pdfName(bill);

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

  // 2) Phones (and Chrome on Windows/ChromeOS): share sheet with the real PDF attached.
  const probe = new File([""], name, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [probe] })) {
    try {
      const pdf = await getInvoicePdf(bill, shop);
      await navigator.share({
        files: [new File([pdf], name, { type: "application/pdf" })],
        title: name,
        text: waMessage(bill, shop.name),
      });
      return { ok: true, msg: `Shared — choose ${bill.name}'s chat in WhatsApp if asked.` };
    } catch (err) {
      if ((err as Error).name === "AbortError") return { ok: false, msg: "" };
      // otherwise fall through to option 3
    }
  }

  // 3) Desktop: download the PDF and open this customer's chat with a message ready.
  //    Open the tab before any await so popup blockers allow it.
  const win = window.open("about:blank", "_blank");
  try {
    const pdf = await getInvoicePdf(bill, shop);
    downloadBlob(pdf, name);
    const url = waLink(bill.phone, waMessage(bill, shop.name));
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
