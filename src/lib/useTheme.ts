'use client';

import { useSyncExternalStore } from 'react';
import { THEME_KEY, nextTheme, parseTheme, resolveTheme, type Theme } from './theme';

const ROOT = '[data-tracker-root]';
const listeners = new Set<() => void>();

const rootEl = () => (typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT));
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function readSaved(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

function apply(t: Theme) {
  rootEl()?.setAttribute('data-theme', t);
  listeners.forEach((l) => l());
}

function snapshot(): Theme {
  return parseTheme(rootEl()?.getAttribute('data-theme')) ?? resolveTheme(readSaved(), systemDark());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  // Follow the system only while the user has not made a choice.
  const onSystem = () => { if (!readSaved()) apply(resolveTheme(null, mq.matches)); };
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) apply(resolveTheme(readSaved(), mq.matches)); };
  mq.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current tracker theme plus a toggle that saves the choice (overrides the system until changed). */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light' as Theme);
  const toggle = () => {
    const n = nextTheme(snapshot());
    try { localStorage.setItem(THEME_KEY, n); } catch { /* storage unavailable: choice lasts this session only */ }
    apply(n);
  };
  return { theme, toggle };
}
