/* FR-26: numeric fields accept only digits and one decimal point; caret is kept. Pure. */

/** Strip everything except digits and the first decimal point. */
export function sanitizeNumeric(raw: string): string {
  const stripped = raw.replace(/[^0-9.]/g, '');
  const i = stripped.indexOf('.');
  if (i < 0) return stripped;
  return stripped.slice(0, i + 1) + stripped.slice(i + 1).replace(/\./g, '');
}

/**
 * Sanitise a typed value and compute where the caret should sit afterwards:
 * the caret moves left by however many characters were removed before it.
 */
export function sanitizeWithCaret(raw: string, caret: number | null): { value: string; caret: number } {
  const c = caret == null ? raw.length : Math.max(0, Math.min(caret, raw.length));
  const value = sanitizeNumeric(raw);
  const beforeClean = sanitizeNumeric(raw.slice(0, c));
  // If an extra decimal point after the caret was dropped, the prefix may still be longer than value.
  return { value, caret: Math.min(beforeClean.length, value.length) };
}
