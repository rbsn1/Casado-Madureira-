"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={clsx(
          "flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-bg p-6 shadow-xl focus:outline-none",
          className
        )}
      >
        {title ? (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full border border-border px-3 py-1 text-sm text-text-muted hover:border-brand-300 hover:text-text"
            >
              Fechar
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
