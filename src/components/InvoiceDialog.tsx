"use client";
import { useEffect, useState } from "react";
import { isEdited, pdfName } from "@/lib/format";
import { copyInvoiceImage, downloadBlob, getInvoiceImage, getInvoicePdf, prepareInvoiceFiles, readyImage } from "@/lib/pdf";
import { sendInvoice, type SendResult } from "@/lib/share";
import type { Bill, Shop } from "@/lib/types";
import InvoicePreview from "./InvoicePreview";
import { EditedBadge } from "./BillsTable";
import Modal from "./Modal";
import DialogHeader from "./DialogHeader";
import { CopyIcon, WhatsAppIcon } from "./icons";

type Props = {
  open: boolean;
  bill: Bill | null;
  shop: Shop;
  cloudApi: boolean;
  initialStatus?: SendResult | null;
  onClose: () => void;
};

export default function InvoiceDialog(props: Props) {
  return (
    <Modal open={props.open && !!props.bill} onClose={props.onClose} id="invDlg">
      {props.bill && <InvoiceView {...props} bill={props.bill} />}
    </Modal>
  );
}

function InvoiceView({ bill, shop, cloudApi, initialStatus, onClose }: Props & { bill: Bill }) {
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState<SendResult>(initialStatus ?? { ok: true, msg: "Preparing the invoice…" });

  // Build the PDF and the image first, so Copy / Download / Send work instantly on tap
  // (phones only allow sharing/copying for a few seconds after a tap).
  useEffect(() => {
    let live = true;
    prepareInvoiceFiles(bill, shop)
      .then(() => { if (live) { setBusy(false); if (!initialStatus) setStatus({ ok: true, msg: "Ready." }); } })
      .catch((err) => { if (live) { setBusy(false); setStatus({ ok: false, msg: `PDF failed: ${err.message}` }); } });
    return () => { live = false; };
  }, [bill, shop, initialStatus]);

  async function download() {
    try {
      downloadBlob(await getInvoicePdf(bill, shop), pdfName(bill));
      setStatus({ ok: true, msg: "PDF downloaded." });
    } catch (err) {
      setStatus({ ok: false, msg: `PDF failed: ${(err as Error).message}` });
    }
  }

  // Copy the invoice as a PNG image to the clipboard (paste into WhatsApp, email, …).
  // If this phone/browser can't copy images: share the image instead, else download it.
  async function copyImage() {
    const pngName = pdfName(bill).replace(/\.pdf$/, ".png");
    const failed = await copyInvoiceImage(bill, shop);
    if (!failed) {
      const phone = window.matchMedia?.("(pointer: coarse)").matches;
      setStatus({
        ok: true,
        msg: phone
          ? "Image copied. In WhatsApp, paste it from your keyboard's clipboard. If it won't paste, use Send to WhatsApp."
          : "Invoice image copied — paste it anywhere (WhatsApp, email, …).",
      });
      return;
    }
    const png = readyImage(bill, shop);
    const file = png && new File([png], pngName, { type: "image/png" });
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: pngName });
        setStatus({ ok: true, msg: "This phone can't copy images, so the share menu opened with the image instead." });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") { setStatus({ ok: true, msg: "" }); return; }
      }
    }
    try {
      downloadBlob(png ?? (await getInvoiceImage(bill, shop)), pngName);
      setStatus({ ok: true, msg: `This browser can't copy images (${failed}), so the image was downloaded instead.` });
    } catch (err) {
      setStatus({ ok: false, msg: `Couldn't create the image: ${(err as Error).message}` });
    }
  }

  async function send() {
    setBusy(true);
    setStatus({ ok: true, msg: cloudApi ? "Sending…" : "Preparing…" });
    setStatus(await sendInvoice(bill, shop, cloudApi));
    setBusy(false);
  }

  return (
    <>
      <DialogHeader
        title={<>Invoice #{bill.invoice_no}{isEdited(bill) && <EditedBadge when={bill.updated_at} />}</>}
        onClose={onClose}
      />
      <InvoicePreview bill={bill} shop={shop} />
      <div className="dlg-foot inv-foot">
        <span className="inv-status" role="status">
          {status.msg}{" "}
          {status.chatUrl && <a href={status.chatUrl} target="_blank" rel="noopener noreferrer">Open WhatsApp chat</a>}
        </span>
        <div className="btns">
          <button type="button" className="copy-btn" onClick={copyImage} disabled={busy} title="Copy the invoice as an image">
            <CopyIcon /> Copy image
          </button>
          <button type="button" onClick={download} disabled={busy}>Download PDF</button>
          <button type="button" className="wa-btn" onClick={send} disabled={busy}>
            <WhatsAppIcon /> Send to WhatsApp
          </button>
        </div>
      </div>
    </>
  );
}
