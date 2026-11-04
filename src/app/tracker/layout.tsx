import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import s from './trackerRoot.module.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/**
 * Tracker-only layout: swaps the pixel display font for Inter and owns the theme.
 * data-theme lives on this wrapper (never on html/body) so the landing page is unaffected.
 * The inline script sets it before first paint; React never renders the attribute, so hydration stays clean.
 */
export default function TrackerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`${inter.variable} ${s.trackerRoot}`} data-tracker-root="" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} suppressHydrationWarning />
      {children}
    </div>
  );
}
