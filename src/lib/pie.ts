/** Pie geometry only (no business maths): turns slice values into stroke-dasharray segments of one circle. */
export type PieSeg = { frac: number; len: number; offset: number; start: number };

/** Segments for a pie drawn as thick circle strokes. Negative/NaN values count as 0; an all-zero input gives []. */
export function pieSegments(values: number[], circumference: number): PieSeg[] {
  const v = values.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const total = v.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  let acc = 0;
  return v.map((x) => {
    const frac = x / total;
    const seg = { frac, len: frac * circumference, offset: -acc * circumference, start: acc };
    acc += frac;
    return seg;
  });
}

/** Percent label helper for slices: whole number, '<1%' for tiny non-zero slices. */
export function slicePct(frac: number): string {
  if (!(frac > 0)) return '0%';
  const p = frac * 100;
  return p < 1 ? '<1%' : Math.round(p) + '%';
}
