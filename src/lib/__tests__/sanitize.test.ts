import { describe, expect, it } from 'vitest';
import { sanitizeNumeric, sanitizeWithCaret } from '../sanitize';

describe('sanitizeNumeric', () => {
  it('keeps digits and one decimal point', () => {
    expect(sanitizeNumeric('12')).toBe('12');
    expect(sanitizeNumeric('1.5')).toBe('1.5');
    expect(sanitizeNumeric('')).toBe('');
  });
  it('strips letters, signs and spaces', () => {
    expect(sanitizeNumeric('a1b2-c3 ')).toBe('123');
    expect(sanitizeNumeric('-5')).toBe('5');
    expect(sanitizeNumeric('1e3')).toBe('13');
  });
  it('keeps only the first decimal point', () => {
    expect(sanitizeNumeric('1.2.3')).toBe('1.23');
    expect(sanitizeNumeric('..5')).toBe('.5');
  });
});

describe('sanitizeWithCaret', () => {
  it('leaves the caret alone when nothing was removed', () => {
    expect(sanitizeWithCaret('123', 2)).toEqual({ value: '123', caret: 2 });
  });
  it('moves the caret back by removed chars before it', () => {
    // user typed "x" at position 1 of "12" -> "1x2", caret after x = 2
    expect(sanitizeWithCaret('1x2', 2)).toEqual({ value: '12', caret: 1 });
  });
  it('does not move the caret for removals after it', () => {
    expect(sanitizeWithCaret('12x', 1)).toEqual({ value: '12', caret: 1 });
  });
  it('handles a second decimal point typed in the middle', () => {
    expect(sanitizeWithCaret('1..5', 3)).toEqual({ value: '1.5', caret: 2 });
  });
  it('null caret goes to the end', () => {
    expect(sanitizeWithCaret('12a', null)).toEqual({ value: '12', caret: 2 });
  });
});
