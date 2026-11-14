"use client";
import { useLayoutEffect, useRef } from "react";
import type { Bill, Shop } from "@/lib/types";
import InvoiceSheet from "./InvoiceSheet";

/** The A4 invoice (exactly what goes into the PDF), scaled down to fit its container. */
export default function InvoicePreview({ bill, shop }: { bill: Bill; shop: Shop }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current, wrap = wrapRef.current;
    if (!body || !wrap) return;
    const fit = () => {
      const sheet = wrap.firstElementChild as HTMLElement | null;
      if (!sheet) return;
      const s = Math.min(1, (body.clientWidth - 32) / 794);
      sheet.style.transform = `scale(${s})`;
      wrap.style.width = `${794 * s}px`;
      wrap.style.height = `${sheet.offsetHeight * s}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(body);
    wrap.querySelectorAll("img").forEach((img) => img.addEventListener("load", fit));
    return () => ro.disconnect();
  }, [bill, shop]);

  return (
    <div className="inv-body" ref={bodyRef}>
      <div className="inv-preview" ref={wrapRef}><InvoiceSheet bill={bill} shop={shop} /></div>
    </div>
  );
}
