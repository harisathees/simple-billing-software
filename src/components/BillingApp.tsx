"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { sendInvoice, type SendResult } from "@/lib/share";
import { EMPTY_SHOP, type Bill, type BillFilters, type Shop } from "@/lib/types";
import BillFormDialog from "./BillFormDialog";
import BillsTable from "./BillsTable";
import FilterPanel, { activeFilterCount, filterSummary, NO_FILTERS, toBillFilters, type FilterState } from "./FilterPanel";
import InvoiceDialog from "./InvoiceDialog";
import SettingsDialog from "./SettingsDialog";
import ThemeToggle from "./ThemeToggle";
import { DashboardIcon, FilterIcon, GearIcon, LogoutIcon, PlusIcon, SearchIcon } from "./icons";

const PAGE_SIZE = 10;

type Load = { state: "loading" } | { state: "ready" } | { state: "error"; message: string };
/** The bills currently on screen for search `q` (newest first). */
type List = { bills: Bill[]; total: number; nextOffset: number | null; q: string; filters: BillFilters };

const byNewest = (a: Bill, b: Bill) => b.invoice_no - a.invoice_no;

export default function BillingApp() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [list, setList] = useState<List>({ bills: [], total: 0, nextOffset: null, q: "", filters: {} });
  const [filterState, setFilterState] = useState<FilterState>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useMemo(() => toBillFilters(filterState), [filterState]);
  const filterCount = activeFilterCount(filters);
  const [nextInvoiceNo, setNextInvoiceNo] = useState(1);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const [shop, setShop] = useState<Shop>(EMPTY_SHOP);
  const [userEmail, setUserEmail] = useState("");
  const [cloudApi, setCloudApi] = useState(false);

  const [form, setForm] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [invoice, setInvoice] = useState<{ bill: Bill; status: SendResult | null } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const reqId = useRef(0);              // bumps on every new search; stale responses are ignored
  const listRef = useRef(list);
  const loadingMoreRef = useRef(false);
  const firstFetch = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? "" : t)), 3000);
  }, []);

  /* ---- shop details + WhatsApp mode ---- */
  useEffect(() => {
    let live = true;
    Promise.all([api.getShop(), api.whatsappStatus(), api.me()]).then(
      ([s, wa, me]) => { if (live) { setShop(s); setCloudApi(wa.enabled); setUserEmail(me.email); } },
      () => { /* the bills request below shows the error screen */ },
    );
    return () => { live = false; };
  }, [reloadKey]);

  useEffect(() => {
    document.title = shop.name ? `${shop.name} — Billing` : "Billing";
  }, [shop.name]);

  /* ---- first page for the current search (debounced while typing) ---- */
  const fetchFirstPage = useCallback((q: string, filters: BillFilters) => {
    const id = ++reqId.current;
    setSearching(true);
    setMoreError("");
    api.listBills({ q, offset: 0, limit: PAGE_SIZE, filters })
      .then((page) => {
        if (id !== reqId.current) return;
        setList({ bills: page.bills, total: page.total, nextOffset: page.nextOffset, q, filters });
        setNextInvoiceNo(page.nextInvoiceNo);
        setLoad({ state: "ready" });
        // App shortcut ("New bill" on the home-screen icon) → open the form once.
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("new") === "1") {
          window.history.replaceState(null, "", window.location.pathname);
          setForm({ open: true, bill: null });
        }
      }, (err: Error) => {
        if (id !== reqId.current) return;
        setLoad((l) => (l.state === "ready" ? l : { state: "error", message: err.message }));
        notify(`Search failed: ${err.message}`);
      })
      .finally(() => { if (id === reqId.current) setSearching(false); });
  }, [notify]);

  useEffect(() => {
    const delay = firstFetch.current ? 0 : 300;
    firstFetch.current = false;
    const t = window.setTimeout(() => fetchFirstPage(query.trim().toLowerCase(), filters), delay);
    return () => window.clearTimeout(t);
  }, [query, filters, reloadKey, fetchFirstPage]);

  /* ---- infinite scroll: load the next 10 when the bottom comes into view ---- */
  useEffect(() => { listRef.current = list; }, [list]);

  const loadMore = useCallback(() => {
    const cur = listRef.current;
    if (loadingMoreRef.current || cur.nextOffset == null) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const id = reqId.current;
    api.listBills({ q: cur.q, offset: cur.nextOffset, limit: PAGE_SIZE, filters: cur.filters })
      .then((page) => {
        if (id !== reqId.current) return;
        setList((l) => {
          const have = new Set(l.bills.map((b) => b.id));
          return {
            ...l,
            bills: [...l.bills, ...page.bills.filter((b) => !have.has(b.id))],
            total: page.total,
            nextOffset: page.nextOffset,
          };
        });
      }, (err: Error) => { if (id === reqId.current) setMoreError(err.message); })
      .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
  }, []);

  // Re-attached after every page, so if the bottom is still visible (tall screen)
  // the next page loads straight away.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || load.state !== "ready" || list.nextOffset == null || moreError) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: "0px 0px 300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load.state, list.nextOffset, list.bills.length, moreError, loadMore]);

  /* ---- create / edit / delete keep the loaded list in sync ---- */
  function onSaved(saved: Bill, isEdit: boolean) {
    setForm({ open: false, bill: null });
    setNextInvoiceNo((n) => Math.max(n, saved.invoice_no + 1));
    notify(isEdit ? "Bill updated" : "Bill saved");
    setInvoice({ bill: saved, status: null });   // show the invoice right away, ready to send

    if (isEdit) {
      setList((l) => ({ ...l, bills: l.bills.map((b) => (b.id === saved.id ? saved : b)).sort(byNewest) }));
    } else if (list.q) {
      setQuery("");                               // leave the search so the new bill is visible
    } else if (activeFilterCount(list.filters) > 0) {
      fetchFirstPage("", list.filters);           // reload: the new bill may or may not match
    } else {
      setList((l) => {
        const last = l.bills[l.bills.length - 1];
        const inLoadedRange = l.nextOffset == null || !last || saved.invoice_no > last.invoice_no;
        if (!inLoadedRange) return { ...l, total: l.total + 1 };   // it will arrive with a later page
        return {
          ...l,
          bills: [...l.bills, saved].sort(byNewest),
          total: l.total + 1,
          nextOffset: l.nextOffset == null ? null : l.nextOffset + 1,
        };
      });
    }
  }

  // Soft delete (internal): the bill is only marked deleted in the database.
  async function onDelete(bill: Bill) {
    if (!confirm(`Delete invoice #${bill.invoice_no} for ${bill.name}?`)) return;
    try {
      await api.deleteBill(bill.id);
      setList((l) => ({
        ...l,
        bills: l.bills.filter((b) => b.id !== bill.id),
        total: Math.max(0, l.total - 1),
        nextOffset: l.nextOffset == null ? null : Math.max(0, l.nextOffset - 1),
      }));
      notify("Bill deleted");
    } catch (err) {
      notify(`Delete failed: ${(err as Error).message}`);
    }
  }

  async function onShare(bill: Bill) {
    setSharingId(bill.id);
    try {
      const res = await sendInvoice(bill, shop, cloudApi);
      if (res.chatUrl) setInvoice({ bill, status: res });   // popup blocked: show link in the dialog
      else if (res.msg) notify(res.msg);
    } finally {
      setSharingId(null);
    }
  }

  async function logout() {
    try { await api.logout(); } finally { window.location.replace("/login"); }
  }

  function retry() {
    setLoad({ state: "loading" });
    firstFetch.current = true;
    setReloadKey((k) => k + 1);
  }

  const ready = load.state === "ready";

  return (
    <>
      <header>
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shop.logo_url && <img src={shop.logo_url} alt="" />}
          <div>
            <h1>{shop.name || "Billing"}</h1>
            <div className="brand-sub">{[shop.phone, shop.address].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="actions">
          <ThemeToggle />
          <button
            className="icon-only" onClick={() => setSettingsOpen(true)} disabled={!ready}
            title="Shop settings" aria-label="Shop settings"
          >
            <GearIcon />
          </button>
          <button
            className="icon-only" onClick={logout}
            title={userEmail ? `Log out (${userEmail})` : "Log out"} aria-label="Log out"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main>
        {load.state === "loading" && <div className="loading">Loading…</div>}
        {load.state === "error" && <SetupHelp message={load.message} onRetry={retry} />}
        {ready && (
          <>
            <div className="toolbar">
              {(searching || cloudApi) && (
                <span className="count">
                  {searching ? "Searching…" : <span className="badge-auto">● WhatsApp auto-send on</span>}
                </span>
              )}
              <div className="toolbar-right">
                <div className="search-box">
                  <SearchIcon />
                  <input
                    type="search" aria-label="Search bills"
                    placeholder="Search invoice no, customer, WhatsApp, product…"
                    value={query} onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button" className={`filter-btn${filterCount ? " on" : ""}${filtersOpen ? " open" : ""}`}
                  onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}
                  title="Filter bills" aria-label={filterCount ? `Filters (${filterCount} on)` : "Filters"}
                >
                  <FilterIcon />
                  <span className="filter-btn-text">Filter</span>
                  {filterCount > 0 && <span className="filter-count">{filterCount}</span>}
                </button>
                {/* PC only — phones use the floating button */}
                <button className="primary new-toolbar" onClick={() => setForm({ open: true, bill: null })}>
                  <PlusIcon /> New
                </button>
              </div>
            </div>
            {filtersOpen && (
              <FilterPanel value={filterState} onChange={setFilterState} onClear={() => setFilterState(NO_FILTERS)} />
            )}
            {!filtersOpen && filterCount > 0 && (
              <div className="filter-summary">
                <span><b>Filtered:</b> {filterSummary(filterState, filters)} · {list.total} bill{list.total === 1 ? "" : "s"}</span>
                <button className="link-btn" onClick={() => setFilterState(NO_FILTERS)}>Clear</button>
              </div>
            )}
            <BillsTable
              bills={list.bills} filtered={!!list.q || activeFilterCount(list.filters) > 0} sharingId={sharingId}
              onView={(b) => setInvoice({ bill: b, status: null })}
              onEdit={(b) => setForm({ open: true, bill: b })}
              onShare={onShare}
              onDelete={onDelete}
            />
            <div ref={sentinelRef} className="list-foot" aria-live="polite">
              {loadingMore && <><span className="spinner" aria-hidden="true" /> Loading more…</>}
              {!loadingMore && moreError && (
                <>Couldn&apos;t load more bills. <button className="link-btn" onClick={() => setMoreError("")}>Try again</button></>
              )}
              {!loadingMore && !moreError && list.nextOffset == null && list.bills.length > PAGE_SIZE && (
                <>All {list.total} bills loaded</>
              )}
            </div>
          </>
        )}
      </main>

      <BillFormDialog
        open={form.open} bill={form.bill} nextInvoiceNo={nextInvoiceNo} shop={shop}
        onClose={() => setForm({ open: false, bill: null })}
        onSaved={onSaved}
      />
      <InvoiceDialog
        open={!!invoice} bill={invoice?.bill ?? null} shop={shop} cloudApi={cloudApi}
        initialStatus={invoice?.status ?? null}
        onClose={() => setInvoice(null)}
      />
      <SettingsDialog
        open={settingsOpen} shop={shop}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => { setShop(s); setSettingsOpen(false); notify("Settings saved"); }}
      />

      {ready && (
        <Link href="/dashboard" className="fab-left" title="Dashboard" aria-label="Dashboard">
          <DashboardIcon />
        </Link>
      )}

      {ready && (
        <button
          type="button" className="fab" onClick={() => setForm({ open: true, bill: null })}
          aria-label="New bill" title="New bill"
        >
          <PlusIcon /> New
        </button>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status">{toast}</div>
    </>
  );
}

function SetupHelp({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="setup">
      <h2>Can&apos;t reach the database</h2>
      <p className="error">{message}</p>
      <ol>
        <li>Check <code>SUPABASE_URL</code>, <code>SUPABASE_SECRET_KEY</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>.</li>
        <li>Create the tables: run <code>npm run db:push</code> in the project folder (see README).</li>
        <li>Click Retry.</li>
      </ol>
      <button className="primary" onClick={onRetry}>Retry</button>
    </div>
  );
}
