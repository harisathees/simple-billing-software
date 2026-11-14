"use client";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { fmtDate, money } from "@/lib/format";
import type { ProductSuggestion } from "@/lib/types";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Called when a suggestion is chosen (fills product name + its last rate). */
  onPick: (s: ProductSuggestion) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
};

/** Product name input that suggests products from earlier bills as you type. */
export default function ProductField({ value, onChange, onPick, inputRef }: Props) {
  const [found, setFound] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim().toLowerCase();
  const listId = useId();

  // Fetch while the box is focused: recent products when empty, matches when typing.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.findProducts(q, ctrl.signal).then(setFound).catch(() => { /* typing on: ignore */ });
    }, q ? 200 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  // Only show results that still match the text (drops stale responses), and hide
  // the list once the field already holds exactly that product.
  const matches = found.filter((s) => s.product.toLowerCase().includes(q));
  const exact = matches.length === 1 && matches[0].product.toLowerCase() === q;
  const show = open && matches.length > 0 && !exact;

  function pick(s: ProductSuggestion) {
    onPick(s);
    setOpen(false);
    setActive(-1);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!show) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  }

  return (
    <div className="i-product-wrap">
      <input
        className="i-product" type="text" placeholder="Product" aria-label="Product" required autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={listId}
        value={value}
        ref={inputRef}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {show && (
        <ul id={listId} className="suggest product-suggest" role="listbox">
          {matches.map((s, i) => (
            <li
              key={s.product} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <div className="s-phone">{s.product}</div>
              <div className="s-meta">
                Last rate {money(s.rate)} · last billed {fmtDate(s.lastUsed)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
