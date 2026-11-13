"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog> driven by React state. Children mount only while open,
 *  so every form starts fresh each time it's opened. */
export default function Modal({
  open, onClose, id, children,
}: { open: boolean; onClose: () => void; id?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      onCancel={(e) => { e.preventDefault(); onClose(); }}  // Esc key
    >
      {open && children}
    </dialog>
  );
}
