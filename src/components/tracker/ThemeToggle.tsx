'use client';

import { useTheme } from '@/lib/useTheme';
import s from './ui.module.css';

/** Pixel sun (shown in dark mode: click for light) and pixel moon (shown in light mode: click for dark). */
const SUN = 'M5 0h2v2H5zM5 10h2v2H5zM0 5h2v2H0zM10 5h2v2h-2zM2 2h2v1H2zM8 2h2v1H8zM2 9h2v1H2zM8 9h2v1H8zM3 3h6v6H3z';
const MOON = 'M2 0h4v1H2zM1 1h3v1H1zM0 2h3v4H0zM0 6h4v1H0zM6 6h2v1H6zM7 5h1v1H7zM1 7h8v1H1zM2 8h6v1H2z';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={label}
      className={`${s.btn} ${s.themeBtn} ${className || ''}`}
      onClick={toggle}
      suppressHydrationWarning
    >
      <svg viewBox={dark ? '0 0 12 12' : '0 0 9 9'} width="20" height="20" shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
        <path d={dark ? SUN : MOON} />
      </svg>
    </button>
  );
}
