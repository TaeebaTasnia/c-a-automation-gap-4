'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import s from './chartKit.module.css';
import { fmt } from './format';

export const SERIES = [
  { id: 'f', label: 'Forecast', cls: 'barF' },
  { id: 'c', label: 'Confirmed', cls: 'barC' },
  { id: 'u', label: 'Utilized', cls: 'barU' },
] as const;

/** Round-number axis: returns ticks 0..max in equal steps. */
export function niceScale(max: number, target = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((v) => v >= rough) as number) || mag * 10;
  const top = step * Math.ceil(max / step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max: top, ticks };
}

/** Measures an element's width (SSR-safe: starts at `initial`). */
export function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Legend({ items }: { items?: { label: string; cls: string }[] }) {
  const list = items || SERIES.map((x) => ({ label: x.label, cls: x.cls }));
  return (
    <ul className={s.legend} aria-label="Legend">
      {list.map((i) => (
        <li key={i.label}>
          <span className={`${s.sw} ${s['sw_' + i.cls]}`} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export type Cat = {
  key: string | number;
  label: string;
  sub?: string;
  swatch?: string;
  values: [number, number, number];
  selected?: boolean;
  aria: string;
};

type Tip = { i: number; x: number };

type Props = {
  cats: Cat[];
  title: string;
  summary: string;
  onSelect?: (key: string | number) => void;
  minGroup?: number;
  height?: number;
};

/** Grouped pixel bars: forecast / confirmed / utilized per category. */
export function GroupedBars({ cats, title, summary, onSelect, minGroup = 48, height = 264 }: Props) {
  const [ref, width] = useWidth();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [tip, setTip] = useState<Tip | null>(null);

  const mL = 44, mR = 8, mT = 14, mB = cats.some((c) => c.sub) ? 50 : 40;
  const gw = Math.max(minGroup, Math.floor((width - mL - mR) / Math.max(1, cats.length)));
  const svgW = mL + mR + gw * cats.length;
  const plotH = height - mT - mB;
  const maxV = Math.max(0, ...cats.flatMap((c) => c.values));
  const sc = niceScale(maxV);
  const y = (v: number) => mT + plotH - Math.round((v / sc.max) * plotH);
  const barW = Math.max(4, Math.min(22, Math.floor((gw - 12) / 3) - 2));
  const clusterW = barW * 3 + 4;
  const showVals = barW >= 16;

  const activate = (c: Cat) => onSelect && onSelect(c.key);
  const onKey = (e: KeyboardEvent, c: Cat) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(c); }
  };

  const tc = tip ? cats[tip.i] : null;
  const tipRight = tip ? tip.x + gw / 2 + 8 + 176 <= svgW : true;
  const interactive = !!onSelect;

  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.scroll}>
        <div className={s.inner} style={{ width: svgW }}>
          <svg
            width={svgW}
            height={height}
            viewBox={`0 0 ${svgW} ${height}`}
            shapeRendering="crispEdges"
            role={interactive ? 'group' : 'img'}
            aria-label={summary}
            className={s.svg}
          >
            <title>{title}</title>
            <defs>
              <pattern id={`h${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="2" height="2" className={s.hatch} />
                <rect x="2" y="2" width="2" height="2" className={s.hatch} />
              </pattern>
            </defs>
            {sc.ticks.map((t) => (
              <g key={t}>
                <rect x={mL} y={y(t)} width={svgW - mL - mR} height={t === 0 ? 2 : 1} className={t === 0 ? s.axis : s.grid} />
                <text x={mL - 8} y={y(t) + 4} textAnchor="end" className={s.tick}>{fmt(t)}</text>
              </g>
            ))}
            {cats.map((c, i) => {
              const gx = mL + i * gw;
              const cx = gx + Math.round((gw - clusterW) / 2);
              return (
                <g
                  key={c.key}
                  tabIndex={0}
                  role={interactive ? 'button' : 'img'}
                  aria-label={c.aria}
                  aria-pressed={interactive ? !!c.selected : undefined}
                  className={`${s.grp} ${interactive ? s.click : ''}`}
                  onPointerEnter={() => setTip({ i, x: gx + gw / 2 })}
                  onPointerLeave={() => setTip(null)}
                  onFocus={() => setTip({ i, x: gx + gw / 2 })}
                  onBlur={() => setTip(null)}
                  onClick={() => activate(c)}
                  onKeyDown={(e) => onKey(e, c)}
                >
                  <rect x={gx + 1} y={mT} width={gw - 2} height={plotH + 28} className={c.selected ? s.sel : s.hit} />
                  {c.selected && <rect x={gx + 1} y={mT} width={gw - 2} height={plotH + 28} fill={`url(#h${uid})`} opacity="0.35" />}
                  {c.values.map((v, k) => {
                    const bx = cx + k * (barW + 2);
                    const by = y(v);
                    const bh = mT + plotH - by;
                    return (
                      <g key={k}>
                        {bh > 0 && <rect x={bx} y={by} width={barW} height={bh} className={s[SERIES[k].cls]} />}
                        {bh > 0 && k === 0 && <rect x={bx} y={by} width={barW} height={bh} fill={`url(#h${uid})`} />}
                        {bh > 0 && <rect x={bx} y={by} width={barW} height={bh} className={s.outline} />}
                        {showVals && v > 0 && <text x={bx + barW / 2} y={by - 4} textAnchor="middle" className={s.val}>{fmt(v)}</text>}
                      </g>
                    );
                  })}
                  {c.swatch && <rect x={gx + Math.round(gw / 2) - 8} y={mT + plotH + 8} width={16} height={4} fill={c.swatch} />}
                  <text x={gx + gw / 2} y={mT + plotH + (c.swatch ? 26 : 22)} textAnchor="middle" className={c.selected ? s.lblSel : s.lbl}>{c.label}</text>
                  {c.sub && <text x={gx + gw / 2} y={mT + plotH + 40} textAnchor="middle" className={s.sub}>{c.sub}</text>}
                  {c.selected && <rect x={gx + Math.round(gw / 2) - 12} y={height - 4} width={24} height={4} className={s.mark} />}
                </g>
              );
            })}
          </svg>
          {tip && tc && (
            <div
              role="status"
              className={s.tip}
              style={{ left: tip.x + (tipRight ? gw / 2 + 8 : -gw / 2 - 8), top: mT + 4, transform: tipRight ? undefined : 'translateX(-100%)' }}
            >
              <strong className={s.tipT}>{tc.label}{tc.sub ? ' · ' + tc.sub : ''}</strong>
              {SERIES.map((x, k) => (
                <div key={x.id} className={s.tipRow}>
                  <span className={`${s.sw} ${s['sw_' + x.cls]}`} aria-hidden="true" />
                  <span>{x.label}</span>
                  <b>{fmt(tc.values[k], Number.isInteger(tc.values[k]) ? 0 : 1)}</b>
                </div>
              ))}
              {interactive && <span className={s.tipHint}>Click to select</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className={s.empty}><p>{children}</p></div>;
}
