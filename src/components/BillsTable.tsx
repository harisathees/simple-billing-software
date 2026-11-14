"use client";
import { fmtDate, fmtDateTime, isEdited, money, waLink } from "@/lib/format";
import type { Bill } from "@/lib/types";
import { useState } from "react";
import { ChevronDown, EditIcon, EyeIcon, TrashIcon, WhatsAppIcon } from "./icons";

type Props = {
  bills: Bill[];
  total: number;
  query: string;
  sharingId: number | null;
  onView: (b: Bill) => void;
  onEdit: (b: Bill) => void;
  onShare: (b: Bill) => void;
  onDelete: (b: Bill) => void;
};

/** Wide screens: a table. Phones (≤ 720 px): each row is restyled as a card in CSS. */
export default function BillsTable({ bills, total, query, sharingId, onView, onEdit, onShare, onDelete }: Props) {
  // Phones only: which cards are expanded to show WhatsApp, address and items.
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (id: number) =>
    setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="card bills">
      <table>
        <thead>
          <tr>
            <th>Invoice No</th><th>Customer Name</th><th>WhatsApp</th><th>Address</th>
            <th>Date</th><th>Items</th><th className="r">Total</th><th className="r">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr key={b.id} className={open.has(b.id) ? "open" : undefined}>
              <td className="num c-inv">
                <span className="inv-no">{b.invoice_no}</span>
                {isEdited(b) && <EditedBadge when={b.updated_at} />}
              </td>
              <td className="c-name">{b.name}</td>
              <td className="num c-phone">
                <a className="wa" href={waLink(b.phone)} target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp">
                  {b.phone}
                </a>
              </td>
              <td className="c-addr">{b.address}</td>
              <td className="num c-date">{fmtDate(b.bill_date)}</td>
              <td className="c-items">
                <ol className="item-list">
                  {b.items.map((i, n) => (
                    <li key={n}>{i.product} <span className="muted">{i.qty} × {money(i.rate)}</span></li>
                  ))}
                </ol>
              </td>
              <td className="num r c-total"><b>{money(b.total)}</b></td>
              <td className="c-more">
                <button
                  type="button" className="more-btn" onClick={() => toggle(b.id)}
                  aria-expanded={open.has(b.id)}
                >
                  {open.has(b.id) ? "Show less" : `Show more · ${b.items.length} item${b.items.length === 1 ? "" : "s"}`}
                  <ChevronDown />
                </button>
              </td>
              <td className="row-actions c-actions">
                <button className="act icon" onClick={() => onView(b)} title="View invoice" aria-label={`View invoice ${b.invoice_no}`}>
                  <EyeIcon />
                </button>
                <button className="act icon" onClick={() => onEdit(b)} title="Edit bill" aria-label={`Edit bill ${b.invoice_no}`}>
                  <EditIcon />
                </button>
                <button
                  className="act share" onClick={() => onShare(b)} disabled={sharingId === b.id}
                  title={`Send PDF to ${b.phone} on WhatsApp`}
                >
                  <WhatsAppIcon />{sharingId === b.id ? "Sharing…" : "Share"}
                </button>
                <button className="act icon del" onClick={() => onDelete(b)} title="Delete bill" aria-label={`Delete bill ${b.invoice_no}`}>
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bills.length === 0 && (
        <div className="empty">
          {query && total ? "No bills match your search." : <>No bills yet. Click <b>+ New</b> to add one.</>}
        </div>
      )}
    </div>
  );
}

/** Small "Edited" pill; hover/long-press shows when. */
export function EditedBadge({ when }: { when?: string }) {
  const at = fmtDateTime(when);
  return (
    <span className="badge-edited" title={at ? `Edited on ${at}` : "Edited"} aria-label={at ? `Edited on ${at}` : "Edited"}>
      Edited
    </span>
  );
}
