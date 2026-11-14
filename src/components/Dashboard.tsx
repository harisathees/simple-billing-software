"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money, today } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import MonthlyChart from "./MonthlyChart";
import ThemeToggle from "./ThemeToggle";
import { ArrowLeftIcon } from "./icons";

const WHOLE = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const whole = (n: number) => WHOLE.format(Math.round(n));

/** Change vs last month, with an arrow + words (never colour alone). */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return now ? <span className="delta muted">No sales last month</span> : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="delta muted">Same as last month</span>;
  const up = pct > 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {Math.abs(pct)}% {up ? "more" : "less"} than last month
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.dashboard(today()).then(
      (d) => { if (live) setData(d); },
      (e: Error) => { if (live) setError(e.message); },
    );
    return () => { live = false; };
  }, []);

  return <DashboardView data={data} error={error} />;
}

/** The dashboard screen for already-loaded data. */
export function DashboardView({ data, error = "" }: { data: DashboardData | null; error?: string }) {
  return (
    <>
      <header>
        <div className="brand">
          <Link href="/" className="icon-only back-link" aria-label="Back to bills" title="Back to bills">
            <ArrowLeftIcon />
          </Link>
          <div><h1>Dashboard</h1></div>
        </div>
        <div className="actions"><ThemeToggle /></div>
      </header>

      <main className="dash">
        {error && <div className="setup"><p className="error">{error}</p></div>}
        {!data && !error && <div className="loading">Loading…</div>}
        {data && (
          <>
            <section className="dash-hero">
              <div className="muted">Total billed · all invoices</div>
              <div className="hero-figure">{money(data.totals.amount)}</div>
              <div className="muted">
                from <b>{data.totals.invoices.toLocaleString("en-IN")}</b> invoice{data.totals.invoices === 1 ? "" : "s"} to{" "}
                <b>{data.totals.customers.toLocaleString("en-IN")}</b> customer{data.totals.customers === 1 ? "" : "s"}
              </div>
            </section>

            <section className="tiles">
              <div className="tile">
                <div className="tile-label">Invoices created</div>
                <div className="tile-value">{data.totals.invoices.toLocaleString("en-IN")}</div>
                <div className="muted tile-sub">all time</div>
              </div>
              <div className="tile">
                <div className="tile-label">This month</div>
                <div className="tile-value">{whole(data.thisMonth.amount)}</div>
                <div className="muted tile-sub">{data.thisMonth.invoices} invoice{data.thisMonth.invoices === 1 ? "" : "s"}</div>
                <Delta now={data.thisMonth.amount} before={data.lastMonth.amount} />
              </div>
              <div className="tile">
                <div className="tile-label">Today</div>
                <div className="tile-value">{whole(data.today.amount)}</div>
                <div className="muted tile-sub">{data.today.invoices} invoice{data.today.invoices === 1 ? "" : "s"}</div>
              </div>
              <div className="tile">
                <div className="tile-label">Average bill</div>
                <div className="tile-value">{whole(data.totals.average)}</div>
                <div className="muted tile-sub">per invoice</div>
              </div>
            </section>

            <MonthlyChart months={data.months} />

            <div className="dash-two">
              <section className="dash-card">
                <div className="dash-card-head"><div><h2>Top customers</h2><p className="muted">By total billed</p></div></div>
                {data.topCustomers.length === 0 ? <p className="muted">No bills yet.</p> : (
                  <table className="dash-table">
                    <thead><tr><th>Customer</th><th className="r">Invoices</th><th className="r">Amount</th></tr></thead>
                    <tbody>
                      {data.topCustomers.map((c) => (
                        <tr key={c.phone + c.name}>
                          <td><div>{c.name}</div><div className="muted small">{c.phone}</div></td>
                          <td className="r num">{c.invoices}</td>
                          <td className="r num">{money(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <section className="dash-card">
                <div className="dash-card-head"><div><h2>Top products</h2><p className="muted">By amount sold</p></div></div>
                {data.topProducts.length === 0 ? <p className="muted">No bills yet.</p> : (
                  <table className="dash-table">
                    <thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Amount</th></tr></thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.product}>
                          <td>{p.product}</td>
                          <td className="r num">{p.qty.toLocaleString("en-IN")}</td>
                          <td className="r num">{money(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
            <p className="muted small dash-note">Deleted bills are not counted.</p>
          </>
        )}
      </main>
    </>
  );
}
