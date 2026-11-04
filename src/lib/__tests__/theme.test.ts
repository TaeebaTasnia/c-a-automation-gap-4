import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, THEME_KEY, nextTheme, parseTheme, resolveTheme } from '../theme';

describe('theme helpers', () => {
  it('parses only valid themes', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('blue')).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
  it('follows the system when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('garbage', true)).toBe('dark');
  });
  it('lets a saved choice override the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('toggles', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
  it('init script reads the same storage key', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_KEY);
  });
});
