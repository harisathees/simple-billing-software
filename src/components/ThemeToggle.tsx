"use client";
import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

export type Theme = "light" | "dark";
export const THEME_KEY = "billing-theme";

/** Runs in <head> before the page paints, so a saved Dark choice never flashes Light. */
export const themeInitScript = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: still works for this visit */ }
  }

  return (
    <button
      type="button" className="icon-only" onClick={toggle}
      title={`Switch to ${next} theme`} aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
