import { describe, expect, it } from 'vitest';
import { pieSegments, slicePct } from '../pie';

describe('pieSegments', () => {
  it('returns no segments for zero or invalid totals', () => {
    expect(pieSegments([0, 0], 100)).toEqual([]);
    expect(pieSegments([], 100)).toEqual([]);
    expect(pieSegments([-3, NaN], 100)).toEqual([]);
  });
  it('splits a partial pie (26 used of 30)', () => {
    const [a, b] = pieSegments([26, 4], 100);
    expect(a.frac).toBeCloseTo(26 / 30);
    expect(a.offset).toBeCloseTo(0);
    expect(b.start).toBeCloseTo(26 / 30);
    expect(b.offset).toBeCloseTo(-(26 / 30) * 100);
    expect(a.len + b.len).toBeCloseTo(100);
  });
  it('a single full slice covers the circle (over 100% case)', () => {
    const [a] = pieSegments([20], 251.2);
    expect(a.frac).toBe(1);
    expect(a.len).toBeCloseTo(251.2);
  });
});

describe('slicePct', () => {
  it('formats', () => {
    expect(slicePct(0)).toBe('0%');
    expect(slicePct(0.004)).toBe('<1%');
    expect(slicePct(26 / 30)).toBe('87%');
    expect(slicePct(1)).toBe('100%');
  });
});
