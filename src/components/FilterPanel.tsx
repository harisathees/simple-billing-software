"use client";
import { fmtDate, money, today } from "@/lib/format";
import type { BillFilters } from "@/lib/types";

export type DatePreset = "all" | "today" | "week" | "month" | "custom";
export type FilterState = {
  preset: DatePreset;
  from: string;   // custom range only (YYYY-MM-DD)
  to: string;
  min: string;    // amount, as typed
  max: string;
  edited: boolean;
};

export const NO_FILTERS: FilterState = { preset: "all", from: "", to: "", min: "", max: "", edited: false };

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All dates" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

const ymd = (d: Date) => d.toLocaleDateString("en-CA");   // YYYY-MM-DD, local time

/** Turn the panel state into the API's filters (dates resolved in the user's time zone). */
export function toBillFilters(f: FilterState): BillFilters {
  const out: BillFilters = {};
  // Only read the clock when a date preset is chosen (keeps the default render time-free,
  // which Next.js needs to prerender the page).
  if (f.preset === "today") {
    out.from = out.to = today();
  } else if (f.preset === "week") {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));   // weeks start on Monday
    out.from = ymd(monday);
    out.to = today();
  } else if (f.preset === "month") {
    const now = new Date();
    out.from = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    out.to = today();
  } else if (f.preset === "custom") {
    if (f.from) out.from = f.from;
    if (f.to) out.to = f.to;
  }
  const min = f.min.trim() === "" ? NaN : Number(f.min);
  const max = f.max.trim() === "" ? NaN : Number(f.max);
  if (min >= 0) out.min = min;
  if (max >= 0) out.max = max;
  if (f.edited) out.edited = true;
  return out;
}

export function activeFilterCount(f: BillFilters) {
  return (f.from || f.to ? 1 : 0) + (f.min != null || f.max != null ? 1 : 0) + (f.edited ? 1 : 0);
}

/** Short summary, e.g. "This month · ₹500 – ₹2,000 · Edited only". */
export function filterSummary(state: FilterState, f: BillFilters) {
  const parts: string[] = [];
  if (state.preset !== "all" && state.preset !== "custom") {
    parts.push(PRESETS.find((p) => p.key === state.preset)!.label);
  } else if (f.from || f.to) {
    parts.push(f.from && f.to ? `${fmtDate(f.from)} – ${fmtDate(f.to)}` : f.from ? `From ${fmtDate(f.from)}` : `Until ${fmtDate(f.to)}`);
  }
  if (f.min != null && f.max != null) parts.push(`${money(f.min)} – ${money(f.max)}`);
  else if (f.min != null) parts.push(`${money(f.min)} or more`);
  else if (f.max != null) parts.push(`Up to ${money(f.max)}`);
  if (f.edited) parts.push("Edited only");
  return parts.join(" · ");
}

type Props = { value: FilterState; onChange: (f: FilterState) => void; onClear: () => void };

export default function FilterPanel({ value, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="filter-panel" role="region" aria-label="Filters">
      <div className="filter-group">
        <div className="filter-label">Bill date</div>
        <div className="chips" role="radiogroup" aria-label="Bill date">
          {PRESETS.map((p) => (
            <button
              key={p.key} type="button" role="radio" aria-checked={value.preset === p.key}
              className={`chip${value.preset === p.key ? " on" : ""}`}
              onClick={() => set({ preset: p.key })}
            >{p.label}</button>
          ))}
        </div>
        {value.preset === "custom" && (
          <div className="filter-row">
            <label>From<input type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} /></label>
            <label>To<input type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} /></label>
          </div>
        )}
      </div>

      <div className="filter-group">
        <div className="filter-label">Total amount (₹)</div>
        <div className="filter-row">
          <label>Min<input type="number" inputMode="decimal" min={0} placeholder="0" value={value.min} onChange={(e) => set({ min: e.target.value })} /></label>
          <label>Max<input type="number" inputMode="decimal" min={0} placeholder="Any" value={value.max} onChange={(e) => set({ max: e.target.value })} /></label>
        </div>
      </div>

      <div className="filter-group filter-foot">
        <label className="switch">
          <input type="checkbox" checked={value.edited} onChange={(e) => set({ edited: e.target.checked })} />
          <span className="switch-ui" aria-hidden="true" />
          Edited bills only
        </label>
        <button type="button" className="link-btn" onClick={onClear}>Clear all</button>
      </div>
    </div>
  );
}
