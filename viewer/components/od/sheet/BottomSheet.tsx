'use client';

import { useEffect, useRef } from 'react';

const SWIPE_CLOSE_THRESHOLD_PX = 80;

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Bottom sheet primitive. Renders nothing when `open` is false; when true
 * the children land in a fixed-bottom panel with a backdrop overlay.
 *
 * Dismissal triggers: backdrop click, ESC key, and touch swipe-down past
 * the threshold. The component does NOT manage its own open state — the
 * parent owns it and decides what closing means (e.g. setMode back).
 */
export function BottomSheet({
  open,
  onClose,
  children,
  ariaLabel,
}: BottomSheetProps): React.ReactElement | null {
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleTouchStart(e: React.TouchEvent): void {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  }
  function handleTouchEnd(e: React.TouchEvent): void {
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (startY === null) return;
    const endY = e.changedTouches[0]?.clientY ?? startY;
    if (endY - startY >= SWIPE_CLOSE_THRESHOLD_PX) {
      onClose();
    }
  }

  return (
    <>
      <div
        data-testid="bottom-sheet-backdrop"
        className="fixed inset-0 z-30 bg-black/30"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-auto rounded-t-2xl border-t border-border bg-background p-4 shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </section>
    </>
  );
}
