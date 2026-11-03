'use client';

import type { ChangeEvent } from 'react';
import { sanitizeWithCaret } from '@/lib/sanitize';
import type { Cell } from '@/lib/logic';
import s from './ui.module.css';

type Props = {
  value: Cell | undefined;
  onChange: (v: string) => void;
  label: string;
  wide?: boolean;
  dialog?: boolean;
};

/** Controlled numeric-only input (FR-26): digits + one decimal point; caret is kept when characters are stripped. */
export default function NumInput({ value, onChange, label, wide, dialog }: Props) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const r = sanitizeWithCaret(raw, el.selectionStart);
    if (r.value !== raw) {
      el.value = r.value;
      try { el.setSelectionRange(r.caret, r.caret); } catch { /* not supported on this input */ }
    }
    onChange(r.value);
  };
  const cls = [s.num, wide ? s.numWide : '', dialog ? s.numDialog : ''].filter(Boolean).join(' ');
  return (
    <input
      className={cls}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      value={value == null ? '' : String(value)}
      onChange={handle}
    />
  );
}
