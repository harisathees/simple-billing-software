// The printable invoice (A4 at 96 dpi = 794 × 1123 px). Used for the on-screen
// preview and, rendered off-screen, as the source for the PDF.
import { fmtDate, money, num, rupeesInWords } from "@/lib/format";
import type { Bill, Shop } from "@/lib/types";

export default function InvoiceSheet({ bill, shop }: { bill: Bill; shop: Shop }) {
  const initials = (shop.name || "Shop").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const lines = [shop.address, shop.phone && `Mobile: ${shop.phone}`, shop.email, shop.website]
    .filter(Boolean).join("\n");
  const terms = shop.terms.split("\n").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="sheet">
      <div className="curve" aria-hidden="true"><i><i /></i></div>
      <div className="inv-title">INVOICE</div>

      <div className="inv-head">
        <div className="inv-logo-wrap">
          <div className="inv-logo">
            {shop.logo_url
              // eslint-disable-next-line @next/next/no-img-element -- plain <img> is required for PDF capture
              ? <img src={shop.logo_url} alt="" />
              : <span className="initials">{initials}</span>}
          </div>
          <span className="inv-dot a" /><span className="inv-dot b" />
        </div>
        <div className="inv-shop">
          <h2>{shop.name || "Your Shop Name"}</h2>
          {shop.slogan && <div className="slogan">{shop.slogan}</div>}
          <div className="lines">{lines}</div>
        </div>
      </div>

      <div className="inv-meta">
        <div><span className="k">Invoice No.</span> : <b>{bill.invoice_no}</b></div>
        <div><span className="k">Invoice Date</span> : <b>{fmtDate(bill.bill_date)}</b></div>
      </div>

      <div className="inv-line"><span>Name</span><span className="val">{bill.name}</span></div>
      <div className="inv-line"><span>Address</span><span className="val">{bill.address}</span></div>
      <div className="inv-line"><span>WhatsApp Number</span><span className="val">{bill.phone}</span></div>

      <table className="inv-table">
        <colgroup>
          <col style={{ width: 60 }} /><col /><col style={{ width: 76 }} />
          <col style={{ width: 120 }} /><col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr><th>Sl.No.</th><th>Product</th><th>Qty.</th><th>Rate</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {bill.items.map((it, i) => (
            <tr key={i}>
              <td className="c">{i + 1}</td>
              <td>{it.product}</td>
              <td className="c">{it.qty}</td>
              <td className="r">{num(it.rate)}</td>
              <td className="r">{num(it.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="blank" colSpan={3} />
            <td className="r">Total</td>
            <td className="r grand">{money(bill.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="inv-words">Rupees in words : <b>{rupeesInWords(bill.total)}</b></div>
      {terms.length > 0 && (
        <div className="inv-terms">
          Terms &amp; Conditions :
          <ul>{terms.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <div className="inv-sign"><div className="line">Signature</div></div>
      <div className="band" />
    </div>
  );
}
