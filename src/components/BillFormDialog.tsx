"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { digits, money, round2, today } from "@/lib/format";
import type { Bill, Customer, Shop } from "@/lib/types";
import Modal from "./Modal";
import { EyeIcon, PlusIcon } from "./icons";
import DialogHeader from "./DialogHeader";
import InvoicePreview from "./InvoicePreview";
import ProductField from "./ProductField";

type Props = {
  open: boolean;
  bill: Bill | null;          // null = new bill
  nextInvoiceNo: number;      // suggested number for a new bill
  shop: Shop;                 // for the full invoice preview before saving
  onClose: () => void;
  onSaved: (bill: Bill, isEdit: boolean) => void;
};

export default function BillFormDialog(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} id="billDlg">
      <BillForm {...props} />
    </Modal>
  );
}

type Row = { key: number; product: string; qty: string; rate: string };
let rowKey = 0;
const newRow = (p = "", q = "1", r = ""): Row => ({ key: ++rowKey, product: p, qty: q, rate: r });

function BillForm({ bill, nextInvoiceNo, shop, onClose, onSaved }: Props) {
  const isEdit = bill != null;
  const [invoiceNo, setInvoiceNo] = useState(String(bill?.invoice_no ?? nextInvoiceNo));
  const [date, setDate] = useState(bill?.bill_date ?? today());
  const [name, setName] = useState(bill?.name ?? "");
  const [phone, setPhone] = useState(bill?.phone ?? "");
  const [address, setAddress] = useState(bill?.address ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    bill?.items.length ? bill.items.map((i) => newRow(i.product, String(i.qty), String(i.rate))) : [newRow()]);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const productRefs = useRef(new Map<number, HTMLInputElement>());
  const qtyRefs = useRef(new Map<number, HTMLInputElement>());
  const focusKey = useRef<number | null>(null);
  const focusQtyKey = useRef<number | null>(null);
  // Items of the picked customer's last bill, offered when the form already has items.
  const [lastOrder, setLastOrder] = useState<{ invoiceNo: number | null; items: Customer["lastItems"]; filled: boolean } | null>(null);

  const amounts = rows.map((r) => round2(Number(r.qty) * Number(r.rate)));
  const total = round2(amounts.reduce((s, a) => s + a, 0));

  /* ---- customer lookup by WhatsApp number (searches all past bills in Supabase) ---- */
  const [found, setFound] = useState<Customer[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [active, setActive] = useState(-1);
  const q = digits(phone);

  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.findCustomers(q, ctrl.signal).then(setFound).catch(() => { /* typing on: ignore */ });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // Only show results that still match what's typed (older responses are filtered out).
  const matches = q.length >= 2 ? found.filter((c) => digits(c.phone).includes(q)) : [];
  const sugOpen = showSug && matches.length > 0;

  const lastRows = (items: Customer["lastItems"]) => items.map((i) => newRow(i.product, String(i.qty), String(i.rate)));

  function fillFromLastBill(items: Customer["lastItems"]) {
    const filled = lastRows(items);
    focusQtyKey.current = filled[0]?.key ?? null;   // jump to the first Qty
    setRows(filled);
  }

  function pick(c: Customer) {
    setPhone(c.phone);
    setName(c.name);
    setAddress(c.address);
    setShowSug(false);
    setActive(-1);

    const noItemsYet = rows.every((r) => !r.product.trim());
    if (c.lastItems.length && noItemsYet) {
      fillFromLastBill(c.lastItems);
      setLastOrder({ invoiceNo: c.lastInvoiceNo, items: c.lastItems, filled: true });
    } else {
      setLastOrder(c.lastItems.length ? { invoiceNo: c.lastInvoiceNo, items: c.lastItems, filled: false } : null);
      productRefs.current.get(rows[0].key)?.focus();
    }
  }

  function onPhoneKey(e: React.KeyboardEvent) {
    if (!sugOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setShowSug(false); }
  }

  /* ---- items ---- */
  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  function addRow() {
    const r = newRow();
    focusKey.current = r.key;
    setRows((rs) => [...rs, r]);
  }

  /** The bill exactly as it will be saved — shown in the preview. */
  function draftBill(): Bill {
    const items = rows.map((r) => {
      const qty = Number(r.qty) || 0, rate = round2(r.rate);
      return { product: r.product.trim(), qty, rate, amount: round2(qty * rate) };
    });
    return {
      id: bill?.id ?? 0,
      invoice_no: Number(invoiceNo) || 0,
      bill_date: date,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      items,
      total: round2(items.reduce((s, i) => s + i.amount, 0)),
    };
  }

  // Step 1: "Preview" button — the browser checks required fields, then we show the invoice.
  function openPreview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPreviewOpen(true);
  }

  // Step 2: "Save" inside the preview.
  async function save() {
    const no = Number(invoiceNo);   // duplicates are rejected by the database (unique)
    setSaving(true);
    setError("");
    const input = {
      invoice_no: no, bill_date: date, name: name.trim(), phone: phone.trim(), address: address.trim(),
      items: rows.map((r) => ({ product: r.product.trim(), qty: Number(r.qty), rate: Number(r.rate) })),
    };
    try {
      const saved = isEdit ? await api.updateBill(bill.id, input) : await api.createBill(input);
      onSaved(saved, isEdit);
    } catch (err) {
      setError(`${isEdit ? "Update" : "Save"} failed: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={openPreview}>
      <DialogHeader title={isEdit ? `Edit Bill — Invoice #${bill.invoice_no}` : "New Bill"} onClose={onClose} />
      <div className="dlg-body">
        <div>
          <label htmlFor="f_invoice">Invoice No</label>
          <input
            id="f_invoice" type="number" inputMode="numeric" min={1} step={1} required
            value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="f_date">Date</label>
          <input id="f_date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="full">
          <label htmlFor="f_name">Customer Name</label>
          <input id="f_name" type="text" required autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="full phone-wrap">
          <label htmlFor="f_phone">WhatsApp Number</label>
          <input
            id="f_phone" type="tel" required pattern="[0-9+\-\s]{7,15}" placeholder="e.g. 9876543210" autoComplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded={sugOpen} aria-controls="phoneList"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setShowSug(true); setActive(-1); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            onKeyDown={onPhoneKey}
          />
          {sugOpen && (
            <ul id="phoneList" className="suggest" role="listbox">
              {matches.map((c, i) => (
                <li
                  key={c.phone} role="option" aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                >
                  <div className="s-phone">{c.phone}</div>
                  <div className="s-meta">{c.name}{c.address ? ` · ${c.address}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="hint">Start typing — existing customers appear; pick one to fill the name, address and the items from their last bill.</div>
        </div>
        <div className="full">
          <label htmlFor="f_address">Address</label>
          <textarea id="f_address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="full">
          <div className="section-title items-title">Items</div>
          {lastOrder && (
            <div className="last-order" role="status">
              {lastOrder.filled ? (
                <>Filled {lastOrder.items.length} item{lastOrder.items.length === 1 ? "" : "s"} from their last bill
                  {lastOrder.invoiceNo ? ` (#${lastOrder.invoiceNo})` : ""}. Change anything you need.</>
              ) : (
                <>
                  Their last bill{lastOrder.invoiceNo ? ` (#${lastOrder.invoiceNo})` : ""} had{" "}
                  {lastOrder.items.map((i) => i.product).join(", ")}.{" "}
                  <button
                    type="button" className="link-btn"
                    onClick={() => { fillFromLastBill(lastOrder.items); setLastOrder({ ...lastOrder, filled: true }); }}
                  >Use these items</button>
                </>
              )}
            </div>
          )}
          <div className="items-head" aria-hidden="true">
            <span>#</span><span>Product</span><span className="r">Qty</span><span className="r">Rate</span><span className="r">Amount</span><span />
          </div>
          <div id="items">
            {rows.map((r, i) => (
              <div className="item-row" key={r.key}>
                <span className="item-no">{i + 1}</span>
                <ProductField
                  value={r.product}
                  onChange={(v) => setRow(r.key, { product: v })}
                  onPick={(sug) => {
                    setRow(r.key, { product: sug.product });         // name only — rate is typed
                    qtyRefs.current.get(r.key)?.select();          // jump to Qty
                  }}
                  inputRef={(el) => {
                    if (el) {
                      productRefs.current.set(r.key, el);
                      if (focusKey.current === r.key) { el.focus(); focusKey.current = null; }
                    } else productRefs.current.delete(r.key);
                  }}
                />
                <input
                  className="i-qty num-input" type="number" inputMode="decimal" min="0.01" step="any"
                  placeholder="Qty" aria-label="Quantity" required
                  value={r.qty} onChange={(e) => setRow(r.key, { qty: e.target.value })}
                  ref={(el) => {
                    if (el) {
                      qtyRefs.current.set(r.key, el);
                      if (focusQtyKey.current === r.key) { el.select(); focusQtyKey.current = null; }
                    } else qtyRefs.current.delete(r.key);
                  }}
                />
                <input
                  className="i-rate num-input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Rate" aria-label="Rate" required
                  value={r.rate} onChange={(e) => setRow(r.key, { rate: e.target.value })}
                />
                <span className="i-amount" aria-label="Amount">{money(amounts[i])}</span>
                <button
                  type="button" className="icon-btn i-remove" aria-label="Remove item" title="Remove item"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                >×</button>
              </div>
            ))}
          </div>
          <div className="items-foot">
            <button type="button" className="add-item" onClick={addRow}><PlusIcon /> Add item</button>
            <div className="grand-total"><span>Total</span><b>{money(total)}</b></div>
          </div>
        </div>
        {error && <div className="error full">{error}</div>}
      </div>
      <div className="dlg-foot">
        <button type="submit" className="primary preview-btn">
          <EyeIcon /> Preview
        </button>
      </div>

      {/* Full invoice preview — check everything, then Save. */}
      <Modal open={previewOpen} onClose={() => !saving && setPreviewOpen(false)} id="previewDlg">
        <DialogHeader
          title={`Preview — Invoice #${invoiceNo}`}
          onClose={() => !saving && setPreviewOpen(false)}
        />
        <InvoicePreview bill={draftBill()} shop={shop} />
        <div className="dlg-foot">
          <span className={error ? "error" : "inv-status"} role="status">
            {error || "Check the bill. Nothing is saved until you press Save."}
          </span>
          <div className="btns">
            <button type="button" onClick={() => setPreviewOpen(false)} disabled={saving}>Back to edit</button>
            <button type="button" className="primary" onClick={save} disabled={saving}>
              {saving ? (isEdit ? "Updating…" : "Saving…") : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

    </form>
  );
}
