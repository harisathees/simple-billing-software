"use client";
import { useEffect, useState } from "react";
import { isEdited, pdfName } from "@/lib/format";
import { downloadBlob, getInvoicePdf } from "@/lib/pdf";
import { sendInvoice, type SendResult } from "@/lib/share";
import type { Bill, Shop } from "@/lib/types";
import InvoicePreview from "./InvoicePreview";
import { EditedBadge } from "./BillsTable";
import Modal from "./Modal";
import DialogHeader from "./DialogHeader";
import { WhatsAppIcon } from "./icons";

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
  const [status, setStatus] = useState<SendResult>(initialStatus ?? { ok: true, msg: "Preparing PDF…" });

  // Build the PDF in the background so Download / Send are instant.
  useEffect(() => {
    let live = true;
    getInvoicePdf(bill, shop)
      .then(() => { if (live) { setBusy(false); if (!initialStatus) setStatus({ ok: true, msg: "PDF ready." }); } })
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
          <button type="button" onClick={download} disabled={busy}>Download PDF</button>
          <button type="button" className="wa-btn" onClick={send} disabled={busy}>
            <WhatsAppIcon /> Send to WhatsApp
          </button>
        </div>
      </div>
    </>
  );
}
