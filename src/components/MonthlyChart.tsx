"use client";
import { useState } from "react";
import { money } from "@/lib/format";

type Month = { month: string; invoices: number; amount: number };

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const COMPACT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const toDate = (m: string) => new Date(`${m}-01T00:00:00`);

/** Clean axis ticks: 0 and three more round steps covering the max. */
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= rough) ?? rough;
  return [0, step, step * 2, step * 3];
}
const tickLabel = (v: number, top: number) => (top >= 10000 ? `₹${COMPACT.format(v)}` : `₹${v.toLocaleString("en-IN")}`);

/**
 * Billed amount per month (one series → no legend; the title names it).
 * Thin columns from one baseline, 4px rounded tops, hairline grid, hover/focus tooltip,
 * only the latest month directly labelled, and a table view with every value.
 */
export default function MonthlyChart({ months }: { months: Month[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(0, ...months.map((m) => m.amount));
  const t = ticks(max);
  const top = t[t.length - 1];
  const last = months.length - 1;

  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <div>
          <h2>Billed per month</h2>
          <p className="muted">Last 12 months · total of all invoices in each month</p>
        </div>
        <button type="button" className="link-btn" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <table className="dash-table">
          <thead><tr><th>Month</th><th className="r">Invoices</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td>{MONTH_YEAR.format(toDate(m.month))}</td>
                <td className="r num">{m.invoices}</td>
                <td className="r num">{money(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mchart" onMouseLeave={() => setActive(null)}>
          <div className="mchart-plot">
            {t.map((v) => (
              <div key={v} className="mchart-grid" style={{ bottom: `${(v / top) * 100}%` }}>
                <span>{tickLabel(v, top)}</span>
              </div>
            ))}
            <div className="mchart-cols">
              {months.map((m, i) => {
                const h = top ? (m.amount / top) * 100 : 0;
                const label = `${MONTH_YEAR.format(toDate(m.month))}: ${money(m.amount)}, ${m.invoices} invoice${m.invoices === 1 ? "" : "s"}`;
                return (
                  <button
                    key={m.month} type="button" className={`mchart-col${active === i ? " on" : ""}`}
                    aria-label={label}
                    onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                    onClick={() => setActive((a) => (a === i ? null : i))}
                  >
                    {m.amount > 0 && <span className="mchart-bar" style={{ height: `${h}%` }} />}
                    {i === last && m.amount > 0 && active !== i && (
                      <span className="mchart-cap" style={{ bottom: `${h}%` }}>{tickLabel(m.amount, 10000)}</span>
                    )}
                    {active === i && (
                      <span className={`mchart-tip${i > months.length - 4 ? " left" : ""}`} style={{ bottom: `calc(${h}% + 8px)` }}>
                        <b>{MONTH_YEAR.format(toDate(m.month))}</b>
                        <span>{money(m.amount)}</span>
                        <span className="muted">{m.invoices} invoice{m.invoices === 1 ? "" : "s"}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mchart-x" aria-hidden="true">
            {months.map((m) => <span key={m.month}>{MONTH.format(toDate(m.month))}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
