'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import s from './ui.module.css';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Accessible modal: aria-modal, labelled, Esc + backdrop close, Tab wraps inside, focus restored on close. */
export default function Modal({ title, hint, onClose, children }: { title: string; hint?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first || dialogRef.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const a = items[0], z = items[items.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };
  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) closeRef.current(); };

  return (
    <div className={s.backdrop} onMouseDown={onBackdrop} onKeyDown={onKeyDown}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1}>
        <div className={s.dialogHead}>
          <h2 id={titleId} className={s.dialogTitle}>{title}</h2>
          <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </div>
        {hint ? <p className={s.dialogHint}>{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}
