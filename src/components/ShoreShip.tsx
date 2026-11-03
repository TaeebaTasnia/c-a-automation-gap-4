'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Shore Ship - pixel-art ship animation on a dithered shoreline.
// Ported from js/shore-ship.js (itself ported from the Claude Design file) into a React client component.
// The ShoreShip class below is behaviourally verbatim; only the mounting/cleanup is React-specific.
import { useEffect, useRef } from 'react';
import styles from './ShoreShip.module.css';

class ShoreShip {
  // loose typing on purpose: the animation code is a verbatim port of js/shore-ship.js
  [key: string]: any;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.onResize = () => this.setup();
    window.addEventListener('resize', this.onResize);
    this.buildSprites();
    this.setup();
    this.onDown = (e: PointerEvent) => this.down(e);
    this.onMove = (e: PointerEvent) => this.move(e);
    this.onUp = () => this.up();
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    const loop = () => { this.frame(performance.now() / 1000); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  // ---------- sprites ----------
  buildSprites() {
    const SW = 82, SH = 38, OX = 3, OY = 27;
    this.SW = SW; this.SH = SH;
    const shade = (hex: any, k: any) => {
      const n = parseInt(hex.slice(1), 16);
      const f = (v: any) => Math.max(0, Math.min(255, Math.round(v * k)));
      return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
    };
    const make = (draw: any) => {
      const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
      const x = cv.getContext('2d')!;
      const px = (a: any, b: any, w: any, h: any, col: any) => { x.fillStyle = col; x.fillRect(a + OX, b + OY, w, h); };
      draw(px);
      const sh = document.createElement('canvas'); sh.width = SW; sh.height = SH;
      const s = sh.getContext('2d')!;
      s.drawImage(cv, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#3a3a2e'; s.fillRect(0, 0, SW, SH);
      const data = x.getImageData(0, 0, SW, SH).data;
      let x0 = SW, y0 = SH, x1 = 0, y1 = 0;
      for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
        if (data[(j * SW + i) * 4 + 3] > 0) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
      }
      return { cv, sh, data, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
    };
    const C = { deck: '#d9d3c3', deckTop: '#8e9a9c', hatch: '#6f7c80', white: '#efede6', whiteS: '#cfcabc', win: '#26394a' };
    // one sprite set (hull + bridge + 3 container stacks) per livery
    const build = (L: any) => {
      const hull = make((px: any) => {
        px(2, -2, 72, 2, C.deckTop);
        for (let i = 20; i < 70; i += 6) px(i, -2, 5, 1, C.hatch);
        for (let y = 0; y <= 9; y++) {
          const xs = y >= 6 ? (y - 5) * 2 : (y >= 4 ? 1 : 0);
          const xe = 77 - Math.round(y * 1.3);
          const col = y === 0 ? C.deck : y === 1 ? L.hullTop : y <= 5 ? L.hull : y === 6 ? L.boot : y === 9 ? L.redD : L.red;
          px(xs, y, xe - xs, 1, col);
        }
        px(70, 2, 2, 1, '#15232e');
      });
      const parts = [make((px: any) => {
        px(7, -24, 5, 6, L.funnel); px(7, -24, 5, 1, L.hull); px(11, -23, 1, 5, shade(L.funnel, 0.8));
        if (L.band) px(7, -21, 4, 1, L.band);
        px(4, -18, 12, 1, C.whiteS);
        px(2, -17, 16, 3, C.white); px(3, -16, 14, 1, C.win);
        px(4, -14, 12, 14, C.white); px(14, -14, 2, 14, C.whiteS);
        for (const wy of [-12, -8, -4]) for (let wx = 5; wx <= 13; wx += 2) px(wx, wy, 1, 1, C.win);
      })];
      let seed = L.seed; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const stack = (x0: any, ncol: any, tiers: any) => make((px: any) => {
        for (let c = 0; c < ncol; c++) for (let t = 0; t < tiers; t++) {
          const col = L.cols[Math.floor(rnd() * L.cols.length)];
          const x = x0 + c * 6, y = -1 - (t + 1) * 3 + 1;
          px(x, y, 6, 3, col); px(x + 1, y, 1, 2, shade(col, 0.88)); px(x + 3, y, 1, 2, shade(col, 0.88));
          px(x, y + 2, 6, 1, shade(col, 0.72)); px(x + 5, y, 1, 3, shade(col, 0.72));
        }
      });
      parts.push(stack(19, 3, 4), stack(38, 3, 4), stack(57, 2, 3));
      return { hull, parts };
    };
    const own = build({
      hull: '#24394a', hullTop: '#34506a', boot: '#e8e3d6', red: '#9b4a3a', redD: '#7c3a2f', funnel: '#c26f3a', seed: 7,
      cols: ['#3f6f8f', '#c9793f', '#4f8a86', '#c8b28a', '#a5523f', '#34506a', '#d9a441', '#7d8f6a']
    });
    this.hull = own.hull; this.parts = own.parts;
    // fictional companies, muted to sit with the sea and sand palette
    this.fleetSprites = [
      build({ // Tidewell Lines
        hull: '#2f4a3a', hullTop: '#3d5e49', boot: '#e8e3d6', red: '#8a4b36', redD: '#6e3b2b', funnel: '#e0b648', band: '#2f4a3a', seed: 11,
        cols: ['#4f7a5c', '#6d8f5f', '#c8b28a', '#e6dcc0', '#7d8f6a', '#3d5e49', '#b59a6a', '#d9d3c3']
      }),
      build({ // Kestrel Marine
        hull: '#8c9196', hullTop: '#a3a8ac', boot: '#e8e3d6', red: '#9b4a3a', redD: '#7c3a2f', funnel: '#efede6', band: '#b8453a', seed: 23,
        cols: ['#3f6f8f', '#5b8cae', '#efede6', '#d9dfe2', '#34506a', '#c9793f', '#7aa0b8', '#e6ebed']
      })
    ];
  }

  // ---------- world ----------
  shore(u: any) {
    const ss = (a: any, b: any, v: any) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
    return 0.40 + 0.14 * Math.exp(-(((u - 0.35) / 0.17) ** 2)) - 0.18 * ss(0.45, 0.85, u);
  }

  setup() {
    const c = this.canvas;
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    this.P = Math.max(2, Math.min(5, Math.round(w / 420)));
    this.W = Math.ceil(w / this.P); this.H = Math.ceil(h / this.P);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    this.g = document.createElement('canvas'); this.g.width = this.W; this.g.height = this.H;
    this.gx = this.g.getContext('2d');
    this.img = this.gx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.S = new Float32Array(this.W);
    const hex = (s: any) => { const n = parseInt(s.slice(1), 16); return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0; };
    this.sea = ['#e8eee9', '#c3d6d3', '#93b6b5', '#64908f', '#41707a', '#2c555e'].map(hex);
    this.sand = hex('#f2f0ea'); this.wet = hex('#e3e6df'); this.speck = hex('#d8d2c4');
    this.home = { x: this.W * 0.70, y: this.shore(0.70) * this.H + 3, rot: -0.18 };
    this.ship = { ...this.home, mode: 'beached', t0: 0 };
    this.wake = [];
    this.resetParts(0);
    // extra cruisers: phase = initial x offset (x + 100 for dir +1); lanes sit below the main ship's lane (H*0.13)
    const base = Math.max(6, this.W / 40);
    this.fleet = [
      { spr: this.fleetSprites[0], dir: 1, speed: base * 0.8, phase: Math.max(this.W * 0.4, 48) + 100, lane: 0.25, bp: 1.3, rp: 2.1, x: 0, y: 0, rot: 0 },
      { spr: this.fleetSprites[1], dir: -1, speed: base * 0.65, phase: this.W - Math.min(this.W * 0.7, this.W - 48) + 100, lane: 0.36, bp: 4.2, rp: 0.7, x: 0, y: 0, rot: 0 }
    ];
  }

  resetParts(t: any) {
    const homes = [[0.56, 0.20, 0.5], [0.14, 0.34, -0.25], [0.36, 0.53, 0.7], [0.87, 0.64, -0.4]];
    this.pieces = this.parts.map((s: any, i: any) => ({ s, i, x: homes[i][0] * this.W, y: homes[i][1] * this.H, rot: homes[i][2], attached: true, snap: null, born: t }));
    this.ship.mode = 'cruise';
  }

  xf(ox: any, oy: any, rot: any, ax: any, ay: any, lx: any, ly: any) {
    const c = Math.cos(rot), s = Math.sin(rot), dx = lx - ax, dy = ly - ay;
    return [ox + c * dx - s * dy, oy + s * dx + c * dy];
  }
  shipRot(t: any) { return this.ship.rot + (this.ship.mode === 'beached' ? 0.012 * Math.sin(t * 1.1) : 0.025 * Math.sin(t * 1.6)); }
  shipBob(t: any) { return this.ship.mode === 'beached' ? 0 : 0.6 * Math.sin(t * 2); }
  target(p: any, t: any) { return this.xf(this.ship.x, this.ship.y + this.shipBob(t), this.shipRot(t), 41, 31, p.s.cx, p.s.cy); }

  fleetBob(f: any, t: any) { return 0.6 * Math.sin(t * 2 + f.bp); }

  // ---------- input ----------
  pt(e: any) { const r = this.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / this.P, (e.clientY - r.top) / this.P]; }
  hit(gx: any, gy: any) {
    for (let k = this.pieces.length - 1; k >= 0; k--) {
      const p = this.pieces[k]; if (p.attached || p.snap) continue;
      const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = gx - p.x, dy = gy - p.y;
      const lx = c * dx + s * dy + p.s.cx, ly = -s * dx + c * dy + p.s.cy;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const X = Math.floor(lx) + i, Y = Math.floor(ly) + j;
        if (X >= 0 && Y >= 0 && X < this.SW && Y < this.SH && p.s.data[(Y * this.SW + X) * 4 + 3] > 0) return p;
      }
    }
    return null;
  }
  down(e: any) {
    const [gx, gy] = this.pt(e); const p = this.hit(gx, gy); if (!p) return;
    this.drag = { p, ox: gx - p.x, oy: gy - p.y };
    this.pieces = this.pieces.filter((q: any) => q !== p).concat(p);
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }
  move(e: any) {
    const [gx, gy] = this.pt(e);
    if (this.drag) { this.drag.p.x = gx - this.drag.ox; this.drag.p.y = gy - this.drag.oy; return; }
    this.canvas.style.cursor = this.hit(gx, gy) ? 'grab' : 'default';
  }
  up() {
    if (!this.drag) return;
    const p = this.drag.p; this.drag = null; this.canvas.style.cursor = 'grab';
    const t = performance.now() / 1000; const [tx, ty] = this.target(p, t);
    if (this.ship.mode === 'beached' && Math.hypot(tx - p.x, ty - p.y) < 14) p.snap = { t0: t, x: p.x, y: p.y, rot: p.rot };
  }

  // ---------- frame ----------
  frame(t: any) {
    const { W, H, S, buf, sea } = this;
    if (!W) return;
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let x = 0; x < W; x++) { const u = x / W; S[x] = this.shore(u) * H + 2.2 * Math.sin(t * 0.8 + u * 4) + 1.2 * Math.sin(t * 1.7 - u * 9); }
    for (let y = 0; y < H; y++) {
      const sy = Math.sin(y * 0.05), cy = Math.sin(y * 0.11 - t * 0.25);
      for (let x = 0; x < W; x++) {
        const dd = S[x] - y, b = B[(y & 3) * 4 + (x & 3)] / 16;
        let col;
        if (dd > 0) {
          if (dd < 1.5 && b < 0.8) col = sea[0];
          else {
            const n = 0.5 * Math.sin(x * 0.07 + t * 0.35 + sy) * cy + 0.35 * Math.sin((x * 0.6 + y) * 0.045 + t * 0.4);
            let l = 1 + Math.min(1, dd / (H * 0.3)) * 4.2 + n * 0.9 + (b - 0.5);
            if (dd < 4) l -= (4 - dd) / 4 * 1.4;
            const fl = 9 + 3 * Math.sin(t * 0.8 + x / W * 5);
            if (Math.abs(dd - fl) < 1.2 && b > 0.45) l = 0.4;
            col = sea[Math.max(0, Math.min(5, Math.round(l)))];
          }
        } else {
          const ds = -dd;
          col = ds < 6 && b < (1 - ds / 6) * 0.75 ? this.wet : this.sand;
          if (ds > 2) { const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; if (hsh - Math.floor(hsh) < 0.045) col = this.speck; }
        }
        buf[y * W + x] = col;
      }
    }
    const g = this.gx; g.putImageData(this.img, 0, 0); g.imageSmoothingEnabled = false;

    this.updateShip(t);
    // wake
    this.wake = this.wake.filter((w: any) => t - w.t0 < 1.6);
    g.fillStyle = '#eef3ef';
    for (const w of this.wake) {
      const a = (t - w.t0) / 1.6, spread = a * 7;
      g.globalAlpha = 1 - a;
      g.fillRect(Math.round(w.x + w.nx * spread), Math.round(w.y + w.ny * spread), 1, 1);
      g.fillRect(Math.round(w.x - w.nx * spread), Math.round(w.y - w.ny * spread), 1, 1);
    }
    g.globalAlpha = 1;

    const sr = this.shipRot(t), sb = this.shipBob(t);
    const put = (spr: any, ox: any, oy: any, rot: any, ax: any, ay: any, alpha = 1, shOff = 1, fl = 1) => {
      g.save(); g.globalAlpha = 0.22 * alpha; g.translate(Math.round(ox + shOff), Math.round(oy + shOff * 1.3)); g.rotate(rot); g.scale(fl, 1); g.drawImage(spr.sh, -ax, -ay); g.restore();
      g.save(); g.globalAlpha = alpha; g.translate(Math.round(ox), Math.round(oy)); g.rotate(rot); g.scale(fl, 1); g.drawImage(spr.cv, -ax, -ay); g.restore();
    };
    // all ships far (small y) to near; a mirrored ship is flipped about its anchor (41,31), so its position is unchanged
    const ships = [{ y: this.ship.y + sb, draw: () => {
      put(this.hull, this.ship.x, this.ship.y + sb, sr, 41, 31);
      for (const p of this.pieces) if (p.attached) {
        g.save(); g.translate(Math.round(this.ship.x), Math.round(this.ship.y + sb)); g.rotate(sr); g.drawImage(p.s.cv, -41, -31); g.restore();
      }
    } }];
    for (const f of this.fleet) {
      const fy = f.y + this.fleetBob(f, t), fr = f.rot + 0.025 * Math.sin(t * 1.6 + f.rp);
      ships.push({ y: fy, draw: () => {
        put(f.spr.hull, f.x, fy, fr, 41, 31, 1, 1, f.dir);
        for (const s of f.spr.parts) { g.save(); g.translate(Math.round(f.x), Math.round(fy)); g.rotate(fr); g.scale(f.dir, 1); g.drawImage(s.cv, -41, -31); g.restore(); }
      } });
    }
    ships.sort((a, b) => a.y - b.y);
    for (const s of ships) s.draw();
    for (const p of this.pieces) {
      if (p.attached) continue;
      const alpha = Math.min(1, (t - p.born) / 0.6);
      if (p.snap) {
        const k = Math.min(1, (t - p.snap.t0) / 0.28), e = 1 - Math.pow(1 - k, 3);
        const [tx, ty] = this.target(p, t);
        p.x = p.snap.x + (tx - p.snap.x) * e; p.y = p.snap.y + (ty - p.snap.y) * e; p.rot = p.snap.rot + (sr - p.snap.rot) * e;
        if (k >= 1) { p.attached = true; p.snap = null; continue; }
        put(p.s, p.x, p.y, p.rot, p.s.cx, p.s.cy, 1, 1 + 2 * (1 - e));
        continue;
      }
      const dragging = this.drag && this.drag.p === p;
      if (dragging) {
        const [tx, ty] = this.target(p, t);
        if (Math.hypot(tx - p.x, ty - p.y) < 30) p.rot += (sr - p.rot) * 0.12;
        put(p.s, p.x, p.y - 1, p.rot, p.s.cx, p.s.cy, alpha, 4);
      } else {
        const ix = Math.max(0, Math.min(W - 1, Math.round(p.x)));
        const wet = S[ix] - p.y > 0;
        const by = wet ? 0.7 * Math.sin(t * 2 + p.i * 1.7) : 0, br = wet ? 0.03 * Math.sin(t * 1.4 + p.i) : 0;
        put(p.s, p.x, p.y + by, p.rot + br, p.s.cx, p.s.cy, alpha, 1);
      }
    }

    const c = this.canvas, ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sc = this.P * (c.width / innerWidth);
    ctx.drawImage(this.g, 0, 0, W * sc, H * sc);
  }

  updateFleet(t: any) {
    const span = this.W + 200;
    for (const f of this.fleet) {
      const d = f.dir, u = ((t * f.speed + f.phase) % span) - 100;
      f.x = d > 0 ? u : this.W - u;
      f.rot = -0.04 * d;
      // keep the whole hull (about 40px either side) over water: use the highest shore point under it
      const sy = Math.min(...[-40, 0, 40].map(o => this.shore(Math.max(0, Math.min(1, (f.x + o) / this.W))))) * this.H;
      f.y = Math.min(this.H * f.lane, sy - 21);
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      // stern is local -x and bow local +x; mirroring (d = -1) swaps them along the ship axis
      if (Math.random() < 0.8) this.wake.push({ x: f.x - d * c * 40 - s * 4, y: f.y - d * s * 40 + c * 4, nx: -s, ny: c, t0: t });
      if (Math.random() < 0.5) this.wake.push({ x: f.x + d * c * 36, y: f.y + d * s * 36 + 4, nx: -s, ny: c, t0: t - 0.8 });
    }
  }

  updateShip(t: any) {
    this.updateFleet(t);
    const sh = this.ship, ease = (k: any) => k * k * (3 - 2 * k);
    if (sh.mode === 'cruise') {
      const span = this.W + 200, speed = Math.max(6, this.W / 40);
      sh.x = ((t * speed) % span) - 100;
      sh.rot = -0.04;
      const su = Math.max(0, Math.min(1, sh.x / this.W));
      sh.y = Math.min(this.H * 0.13, this.shore(su) * this.H - 18);
      const c = Math.cos(sh.rot), s = Math.sin(sh.rot);
      if (Math.random() < 0.8) this.wake.push({ x: sh.x - c * 40 - s * 4, y: sh.y - s * 40 + c * 4, nx: -s, ny: c, t0: t });
      if (Math.random() < 0.5) this.wake.push({ x: sh.x + c * 36, y: sh.y + s * 36 + 4, nx: -s, ny: c, t0: t - 0.8 });
      return;
    }
    const emitWake = () => {
      const c = Math.cos(sh.rot), s = Math.sin(sh.rot);
      const sx = sh.x - c * 38 - s * 6, sy = sh.y - s * 38 + c * 6;
      this.wake.push({ x: sx, y: sy, nx: -s, ny: c, t0: t });
    };
    if (sh.mode === 'launch') {
      const a = t - sh.t0;
      if (a < 0.7) { const k = Math.sin(a / 0.7 * Math.PI); sh.x = this.home.x - k * 1.2; sh.y = this.home.y + k * 0.8; }
      else {
        const s = a - 0.7, d = 5 * s * s;
        sh.rot = this.home.rot - Math.min(0.25, s * 0.08);
        sh.x = this.home.x + Math.cos(sh.rot) * d; sh.y = this.home.y + Math.sin(sh.rot) * d - s * s * 1.5;
        emitWake();
        if (sh.x > this.W + 90 || sh.y < -60) { sh.mode = 'gone'; sh.t0 = t; }
      }
    } else if (sh.mode === 'gone') {
      if (t - sh.t0 > 1.4) { this.resetParts(t); sh.mode = 'returning'; sh.t0 = t; }
    } else if (sh.mode === 'returning') {
      const k = Math.min(1, (t - sh.t0) / 3.2), e = ease(k);
      const sx = this.W + 70, sy = this.home.y - this.H * 0.18;
      sh.x = sx + (this.home.x - sx) * e; sh.y = sy + (this.home.y - sy) * e; sh.rot = this.home.rot + 0.15 * (1 - e);
      if (k < 0.92) emitWake();
      if (k >= 1) { sh.mode = 'beached'; sh.x = this.home.x; sh.y = this.home.y; sh.rot = this.home.rot; }
    }
  }
}

export default function ShoreShipStage() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // full-screen stage: no page scroll on this route only (restored on unmount)
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden';
    const ship = new ShoreShip(canvas);
    return () => {
      ship.destroy();
      html.style.overflow = prev[0]; body.style.overflow = prev[1];
    };
  }, []);

  return (
    <div className={styles.stage}>
      <canvas ref={ref} className={styles.canvas} aria-label="Animated pixel-art container ship sailing along a shoreline" />
    </div>
  );
}
