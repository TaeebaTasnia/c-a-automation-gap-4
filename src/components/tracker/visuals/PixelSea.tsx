'use client';
import { useEffect, useRef } from 'react';
import s from './PixelSea.module.css';
import { useTheme } from '@/lib/useTheme';

const HEIGHT = 136;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const RAMP_LIGHT = ['#e8eee9', '#c3d6d3', '#93b6b5', '#64908f', '#41707a', '#2c555e'];
const RAMP_DARK = ['#4a8591', '#3a6f7b', '#2d5a66', '#214652', '#17343f', '#10262f'];
const SAND_LIGHT = { sand: '#f2f0ea', wet: '#e3e6df', speck: '#d8d2c4', foam: '#eef3ef' };
const SAND_DARK = { sand: '#2a4a58', wet: '#356372', speck: '#3f6f7d', foam: '#9fc3c4' };

type Livery = { hull: string; hullTop: string; boot: string; red: string; funnel: string; band?: string; cols: string[]; seed: number };
const LIVERIES: Livery[] = [
  { hull: '#24394a', hullTop: '#34506a', boot: '#e8e3d6', red: '#9b4a3a', funnel: '#c26f3a', seed: 7, cols: ['#3f6f8f', '#c9793f', '#4f8a86', '#c8b28a', '#a5523f', '#34506a', '#d9a441', '#7d8f6a'] },
  { hull: '#2f4a3a', hullTop: '#3d5e49', boot: '#e8e3d6', red: '#8a4b36', funnel: '#e0b648', band: '#2f4a3a', seed: 11, cols: ['#4f7a5c', '#6d8f5f', '#c8b28a', '#e6dcc0', '#7d8f6a', '#3d5e49', '#b59a6a', '#d9d3c3'] },
];

function hex32(h: string): number {
  const n = parseInt(h.slice(1), 16);
  return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0;
}

/** Small container-ship sprite (36 x 14 buffer pixels), drawn with rects. */
function makeSprite(L: Livery): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 38; cv.height = 14;
  const g = cv.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(1, 9, 36, 1, L.hullTop);
  px(1, 10, 36, 1, L.hull);
  px(2, 11, 34, 1, L.boot);
  px(4, 12, 30, 1, L.red);
  px(6, 13, 26, 1, '#7c3a2f');
  // bridge + funnel
  px(2, 3, 8, 6, '#efede6'); px(3, 4, 6, 1, '#26394a'); px(8, 3, 2, 6, '#cfcabc');
  px(4, 0, 3, 3, L.funnel); px(4, 0, 3, 1, L.hull);
  if (L.band) px(4, 1, 3, 1, L.band);
  // containers
  let seed = L.seed;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let c = 0; c < 6; c++) {
    const tiers = 1 + Math.floor(rnd() * 2) + (c % 3 === 1 ? 1 : 0);
    for (let t = 0; t < tiers; t++) {
      const col = L.cols[Math.floor(rnd() * L.cols.length)];
      const x = 11 + c * 4, y = 9 - (t + 1) * 3;
      px(x, y, 4, 3, col); px(x, y + 2, 4, 1, 'rgba(0,0,0,0.28)'); px(x + 3, y, 1, 3, 'rgba(0,0,0,0.22)');
    }
  }
  return cv;
}

export default function PixelSea({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const darkRef = useRef(theme === 'dark');
  const redrawRef = useRef<(() => void) | null>(null);

  // Theme changes re-ramp the palette in place; the animation loop is not remounted.
  useEffect(() => {
    darkRef.current = theme === 'dark';
    redrawRef.current?.();
  }, [theme]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sprites = LIVERIES.map(makeSprite);

    let W = 0, H = 0;
    let img: ImageData | null = null;
    let buf: Uint32Array | null = null;
    let S = new Float32Array(0);
    let ramp: number[] = [];
    let sand = { sand: 0, wet: 0, speck: 0, foam: '' };
    let raf = 0;
    let last = 0;
    let t0 = 0;
    let running = false;

    const palette = () => {
      ramp = (darkRef.current ? RAMP_DARK : RAMP_LIGHT).map(hex32);
      const p = darkRef.current ? SAND_DARK : SAND_LIGHT;
      sand = { sand: hex32(p.sand), wet: hex32(p.wet), speck: hex32(p.speck), foam: p.foam };
    };

    const setup = () => {
      const w = Math.max(1, wrap.clientWidth);
      const P = w < 560 ? 3 : 4;
      W = Math.ceil(w / P);
      H = Math.ceil(HEIGHT / P);
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = false;
      img = ctx.createImageData(W, H);
      buf = new Uint32Array(img.data.buffer);
      S = new Float32Array(W);
      palette();
    };

    const frame = (t: number) => {
      if (!img || !buf || !W) return;
      const shore = H - 6;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        S[x] = shore + 1.4 * Math.sin(t * 0.8 + u * 7) + 0.8 * Math.sin(t * 1.7 - u * 13) + 1.6 * Math.sin(u * 5 + 1);
      }
      for (let y = 0; y < H; y++) {
        const sy = Math.sin(y * 0.09), cy = Math.sin(y * 0.2 - t * 0.25);
        for (let x = 0; x < W; x++) {
          const dd = S[x] - y;
          const b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
          let col: number;
          if (dd > 0) {
            if (dd < 1.5 && b < 0.8) col = ramp[0];
            else {
              const n = 0.5 * Math.sin(x * 0.07 + t * 0.35 + sy) * cy + 0.35 * Math.sin((x * 0.6 + y) * 0.045 + t * 0.4);
              let l = 0.6 + Math.min(1, dd / (H * 0.8)) * 4.6 + n * 0.9 + (b - 0.5);
              if (dd < 4) l -= ((4 - dd) / 4) * 1.4;
              const fl = 7 + 2.5 * Math.sin(t * 0.8 + u(x, W) * 5);
              if (Math.abs(dd - fl) < 1.1 && b > 0.5) l = 0.3;
              col = ramp[Math.max(0, Math.min(5, Math.round(l)))];
            }
          } else {
            const ds = -dd;
            col = ds < 4 && b < (1 - ds / 4) * 0.75 ? sand.wet : sand.sand;
            if (ds > 1.5) {
              const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
              if (hsh - Math.floor(hsh) < 0.06) col = sand.speck;
            }
          }
          buf[y * W + x] = col;
        }
      }
      ctx.putImageData(img, 0, 0);

      // ships: horizontal cruise lanes, simple wake, gentle bob
      const ships = [
        { spr: sprites[0], dir: 1, speed: 4.5, phase: 0.2, lane: 0.22 },
        { spr: sprites[1], dir: -1, speed: 3.2, phase: 0.62, lane: 0.5 },
      ];
      const span = W + 80;
      for (const sh of ships) {
        const raw = (sh.phase * span + sh.dir * t * sh.speed) % span;
        const pos = (raw + span) % span - 40;
        const bob = Math.round(0.7 * Math.sin(t * 2 + sh.phase * 9));
        const y = Math.round(sh.lane * H + bob);
        const flip = sh.dir < 0;
        const x = Math.round(pos);
        // wake behind the stern
        ctx.fillStyle = sand.foam;
        for (let k = 0; k < 5; k++) {
          const wx = flip ? x + 38 + k * 3 : x - 3 - k * 3;
          ctx.globalAlpha = 1 - k * 0.2;
          ctx.fillRect(wx, y + 13, 2, 1);
          if (k > 1) ctx.fillRect(wx + (flip ? 1 : -1), y + 14 + (k & 1), 1, 1);
        }
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#10202a';
        ctx.fillRect(x + 2, y + 14, 34, 1);
        ctx.globalAlpha = 1;
        ctx.save();
        if (flip) { ctx.translate(x + 38, y); ctx.scale(-1, 1); ctx.drawImage(sh.spr, 0, 0); }
        else ctx.drawImage(sh.spr, x, y);
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      frame((now - t0) / 1000 + 3);
    };
    const start = () => {
      if (running || mqMotion.matches || document.hidden) return;
      running = true;
      t0 = performance.now();
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const redraw = () => { palette(); frame(3); };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    const onMotion = () => { stop(); frame(3); start(); };
    const onResize = () => { setup(); frame(3); };

    setup();
    frame(3);
    start();

    const ro = new ResizeObserver(() => onResize());
    ro.observe(wrap);
    document.addEventListener('visibilitychange', onVis);
    mqMotion.addEventListener('change', onMotion);
    redrawRef.current = redraw;
    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      mqMotion.removeEventListener('change', onMotion);
      redrawRef.current = null;
    };
  }, []);

  return (
    <div ref={wrapRef} className={`${s.wrap}${className ? ' ' + className : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className={s.canvas} />
    </div>
  );
}

function u(x: number, W: number): number { return x / W; }
