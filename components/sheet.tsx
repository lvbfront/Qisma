"use client";

import { useEffect, useRef } from "react";

/** Modal on a native <dialog>: bottom sheet on mobile, centred card from md up. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on the backdrop
      className="inset-0 mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-card bg-surface text-ink backdrop:bg-black/40 md:m-auto md:max-w-md md:rounded-card"
    >
      {/* Children mount only while open, so every opening starts from fresh form state. */}
      {open && (
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-heading font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="grid size-10 place-items-center rounded-control text-heading text-muted hover:text-ink"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
