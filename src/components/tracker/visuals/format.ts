/** Display formatting helpers (locale fixed to en-US so SSR and client output match). */

export function fmt(n: number, d = 0): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Whole-number percent from a 0..1 ratio; em dash when null. */
export function pct(p: number | null | undefined): string {
  return p == null || Number.isNaN(p) ? '—' : Math.round(p * 100) + '%';
}

/** Signed whole number with a real minus sign; 0 stays unsigned. */
export function signed(n: number): string {
  const r = Math.round(n);
  return r === 0 ? '0' : (r < 0 ? '−' : '+') + fmt(Math.abs(r));
}

/** Signed one-decimal number. */
export function signed1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? '0' : (r < 0 ? '−' : '+') + fmt(Math.abs(r), 1);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Signed whole-number percent from a ratio (0.12 -> '+12%'). */
export function signedPct(p: number): string {
  const r = Math.round(p * 100);
  return r === 0 ? '0%' : (r < 0 ? '−' : '+') + Math.abs(r) + '%';
}
