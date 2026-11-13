"use client";
import type { InputHTMLAttributes } from "react";
import { ChevronDown, ChevronUp } from "./icons";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (v: string) => void;
  /** Amount the arrows add/subtract. */
  stepBy?: number;
  /** Lowest value the arrows go to (typing can still go lower if `min` allows). */
  stepMin?: number;
  wrapperClassName?: string;
};

/** Number input with small custom up/down arrows instead of the browser's spinner. */
export default function NumberField({ value, onChange, stepBy = 1, stepMin = 0, wrapperClassName = "", ...rest }: Props) {
  function bump(dir: 1 | -1) {
    const v = Number(value) || 0;
    const next = Math.round((v + dir * stepBy) * 100) / 100;
    onChange(String(Math.max(stepMin, next)));
  }

  return (
    <div className={`num-field ${wrapperClassName}`}>
      <input {...rest} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="stepper">
        <button type="button" tabIndex={-1} aria-label="Increase" onClick={() => bump(1)}><ChevronUp /></button>
        <button type="button" tabIndex={-1} aria-label="Decrease" onClick={() => bump(-1)}><ChevronDown /></button>
      </div>
    </div>
  );
}
