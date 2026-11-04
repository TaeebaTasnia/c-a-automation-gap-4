/** Pure theme helpers (no DOM). The tracker applies the result as data-theme on its root element. */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'cat_theme';

export function parseTheme(v: unknown): Theme | null {
  return v === 'light' || v === 'dark' ? v : null;
}

/** A saved user choice wins; otherwise follow the system preference. */
export function resolveTheme(saved: unknown, systemDark: boolean): Theme {
  return parseTheme(saved) ?? (systemDark ? 'dark' : 'light');
}

export function nextTheme(t: Theme): Theme {
  return t === 'dark' ? 'light' : 'dark';
}

/** Runs before paint (inline in the tracker layout) so the first frame already has the right theme.
 *  It sets data-theme on its parent element, which is the tracker root. */
export const THEME_INIT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem('${THEME_KEY}')}catch(e){}var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.currentScript.parentElement.setAttribute('data-theme',t)}catch(e){}})()`;
