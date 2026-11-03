import type { Metadata, Viewport } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import './globals.css';

const pixel = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
  fallback: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Carrier Allocation Tracker',
  description: 'Carrier allocation & utilization tracker',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
