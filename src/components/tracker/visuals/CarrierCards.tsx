'use client';
import { CARRIERS, num, type WeeklyRow, type WeekCalc, type Config, type CarrierId, type Carrier } from '@/lib/logic';
import s from './CarrierCards.module.css';
import { fmt, pct, signed } from './format';

const COLORS: Record<CarrierId, string> = {
  maersk: 'var(--c-maersk)', hapag: 'var(--c-hapag)', hellman: 'var(--c-hellman)', one: 'var(--c-one)', fml: 'var(--c-fml)',
};
const BLOCKS = 20;

export function Card({ k, i, calc, cfg, hl }: { k: Carrier; i: number; calc: WeekCalc; cfg: Config; hl: boolean }) {
  const id = k.id;
  const p = calc.pct[id];
  const over = p != null && p > 1;
  const filled = p == null ? 0 : Math.round(Math.min(p, 1) * BLOCKS);
  const diff = calc.conf[id] - calc.fc[id];
  const left = calc.left[id];
  const share = calc.share[id];
  const target = id === 'fml' ? null : num(cfg[('pct_' + id) as keyof Config]);
  const barText = p == null ? 'No confirmed TEUs, utilization not available' : `${Math.round(p * 100)}% of confirmed utilized${over ? ', over 100%' : ''}`;
  return (
    <article className={s.card} data-carrier={id} data-hl={hl ? "1" : undefined} style={{ ['--c' as string]: COLORS[id], ['--i' as string]: i }} aria-label={`${k.name} carrier`}>
      <div className={s.topbar} />
      <header className={s.head}>
        <h3 className={s.name}>{k.name}</h3>
        {diff < 0 ? (
          <span className={`${s.chip} ${s.bad}`}><i aria-hidden="true">▼</i>{signed(diff)} vs fcst</span>
        ) : diff > 0 ? (
          <span className={`${s.chip} ${s.good}`}><i aria-hidden="true">▲</i>{signed(diff)} vs fcst</span>
        ) : (
          <span className={`${s.chip} ${s.neutral}`}><i aria-hidden="true">=</i>on forecast</span>
        )}
      </header>
      <div className={s.big}>
        <span className={over ? s.overTxt : undefined}>{pct(p)}</span>
        <small>utilized</small>
        {over && <span className={s.flag}>OVER 100%</span>}
      </div>
      <div className={s.bar} role="img" aria-label={barText}>
        <div className={s.blocks}>
          {Array.from({ length: BLOCKS }, (_, b) => (
            <span key={b} className={`${s.blk} ${b < filled ? (over ? s.blkOver : s.blkOn) : ''}`} />
          ))}
        </div>
        {over && <span className={s.marker} aria-hidden="true">+{Math.round(((p as number) - 1) * 100)}%</span>}
      </div>
      <dl className={s.dl}>
        <dt>Forecast</dt><dd>{fmt(calc.fc[id])}</dd>
        <dt>Confirmed</dt><dd>{fmt(calc.conf[id])}</dd>
        <dt>Utilized</dt><dd>{fmt(calc.util[id])}</dd>
        <dt>Left</dt><dd className={left < 0 ? s.neg : undefined}>{fmt(left)}</dd>
      </dl>
      <div className={s.shareWrap}>
        <div className={s.shareHead}>
          <span>Share of used</span>
          <b>{pct(share)}</b>
        </div>
        <div className={s.share} role="img" aria-label={`Share of used ${pct(share)}${target == null ? ', no target' : `, target ${target}%`}`}>
          <div className={s.shareFill} style={{ width: `${Math.min(100, (share || 0) * 100)}%` }} />
          {target != null && <div className={s.target} style={{ left: `${Math.min(100, target)}%` }} />}
        </div>
        <span className={s.targetTxt}>{target == null ? 'no target' : `target ${target}%`}</span>
      </div>
    </article>
  );
}

export default function CarrierCards({ week, calc, cfg, highlight = null, staged = false }: { week: WeeklyRow; calc: WeekCalc; cfg: Config; highlight?: CarrierId | null; staged?: boolean }) {
  return (
    <div className={s.grid} data-staged={staged ? '1' : undefined}>
      {CARRIERS.map((k, i) => (
        <Card key={`${week.year}-${week.week}-${k.id}`} k={k} i={i} calc={calc} cfg={cfg} hl={highlight === k.id} />
      ))}
    </div>
  );
}
