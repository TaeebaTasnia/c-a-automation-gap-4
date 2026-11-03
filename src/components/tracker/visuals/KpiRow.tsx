'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dayStats, num, status, type WeeklyRow, type WeekCalc, type Config, type DailyMap } from '@/lib/logic';
import s from './KpiRow.module.css';
import { fmt, pct, signed, signedPct } from './format';

/** Number that ticks up/down to a new value in <400ms (skipped for reduced motion). */
function useTick(value: number): number {
  const [anim, setAnim] = useState<number | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 320);
      if (k < 1) { setAnim(from + (value - from) * k); raf = requestAnimationFrame(step); } else setAnim(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return anim ?? value;
}

function Num({ value, d = 0, sign = false }: { value: number; d?: number; sign?: boolean }) {
  const v = useTick(value);
  return <>{sign ? signed(v) : fmt(v, d)}</>;
}

function Tile({ label, tone, className, children, sub, extra }: {
  label: string; tone?: 'bad' | 'good' | 'neutral'; className?: string; children: ReactNode; sub?: ReactNode; extra?: ReactNode;
}) {
  return (
    <section className={`${s.tile} ${tone ? s[tone] : ''} ${className || ''}`} aria-label={label}>
      <h3 className={s.label}>{label}</h3>
      <div className={s.value}>{children}</div>
      {sub != null && <p className={s.sub}>{sub}</p>}
      {extra}
    </section>
  );
}

const SEG = 20;

export default function KpiRow({ week, calc, cfg, daily, today }: {
  week: WeeklyRow; calc: WeekCalc; cfg: Config; daily: DailyMap; today: string;
}) {
  const forecast = num(week.forecast);
  const st = status(calc.deficit);
  const defSub = st === 'deficit' ? 'Deficit – more space needed' : st === 'surplus' ? 'Surplus – space in hand' : 'Balanced';
  const defTone = st === 'deficit' ? 'bad' : st === 'surplus' ? 'good' : 'neutral';
  const defIcon = st === 'deficit' ? '▼' : st === 'surplus' ? '▲' : '=';
  const inWeek = calc.dates.includes(today);
  const td = daily[today];
  const ds = dayStats(td, cfg);

  const upct = calc.utilPct;
  const filled = upct == null ? 0 : Math.round(Math.min(upct, 1) * SEG);
  const uOver = upct != null && upct > 1;

  // balance visual (layout maths only: bar widths from calc values)
  const L = Math.max(0, calc.leftTotal);
  const A = calc.toBeArrived;
  const common = Math.min(L, A);
  const scale = Math.max(L, A, 1);
  const w = (v: number) => `${(v / scale) * 100}%`;
  const balText = `Left in hand ${fmt(calc.leftTotal)} TEU, to be arrived ${fmt(A)} TEU. ${defSub}, ${signed(calc.deficit)} TEU.`;

  return (
    <div className={s.root}>
      <div className={s.grid}>
        <Tile label="Forecast" className={s.r1} sub={`${fmt(calc.cbmPlan)} CBM equivalent`}>
          <Num value={forecast} /><small>TEU +25%</small>
        </Tile>
        <Tile label="Confirmed" className={s.r1} sub={`${signed(calc.totalConf - forecast)} vs forecast`}>
          <Num value={calc.totalConf} /><small>TEU</small>
        </Tile>
        <Tile
          label="Utilized"
          className={s.r1}
          sub={`${pct(upct)} of confirmed · ${pct(calc.vsForecast)} of forecast`}
          extra={
            <div className={s.seg} role="img" aria-label={upct == null ? 'No confirmed TEUs' : `${Math.round(upct * 100)}% of confirmed utilized`}>
              {Array.from({ length: SEG }, (_, i) => (
                <i key={i} className={i < filled ? (uOver ? s.segOver : s.segOn) : undefined} />
              ))}
            </div>
          }
        >
          <Num value={calc.totalUtil} /><small>TEU</small>
        </Tile>
        <Tile label="Left in hand" className={s.r1} tone={calc.leftTotal < 0 ? 'bad' : undefined} sub="Confirmed − utilized">
          <Num value={calc.leftTotal} /><small>TEU</small>
        </Tile>

        <Tile label="To be arrived" className={s.r2} sub={`Plan ${fmt(calc.basis, 1)} − arrived ${fmt(calc.actTeu, 1)} TEU`}>
          <Num value={calc.toBeArrived} /><small>TEU</small>
        </Tile>
        <Tile label="Deficit / Surplus" className={s.r2} tone={defTone} sub={<><span className={s.ico} aria-hidden="true">{defIcon}</span> {defSub}</>}>
          <Num value={calc.deficit} sign /><small>TEU</small>
        </Tile>
        {inWeek ? (
          <Tile
            label="Today"
            className={s.r2}
            sub={
              <>
                Actual {fmt(num(td?.actCbm))} CBM ({fmt(ds.actTeu, 1)} TEU) vs forecast {fmt(num(td?.fcstCbm))} CBM
                {ds.vs != null && <b className={ds.vs < 0 ? s.negTxt : s.posTxt}> {signedPct(ds.vs)}</b>}
              </>
            }
          >
            <Num value={ds.dayTotal} /><small>TEU used</small>
          </Tile>
        ) : (
          <Tile
            label="Week CBM"
            className={s.r2}
            sub={`Actual vs ${fmt(calc.fcstCbm)} CBM forecast${calc.fcstCbm > 0 ? ' (' + pct(calc.actCbm / calc.fcstCbm) + ')' : ''}`}
          >
            <Num value={calc.actCbm} /><small>CBM</small>
          </Tile>
        )}
      </div>

      <section className={`${s.balance} ${s[defTone]}`} aria-label="Space versus demand">
        <header className={s.bHead}>
          <h3 className={s.label}>Space vs demand</h3>
          <span className={`${s.verdict} ${s[defTone + 'V']}`}>
            <span aria-hidden="true">{defIcon}</span> {defSub} · <b>{signed(calc.deficit)}</b> TEU
          </span>
        </header>
        <div className={s.bars} role="img" aria-label={balText} key={`${week.year}-${week.week}`}>
          <div className={s.bRow}>
            <span className={s.bLab}>Left in hand</span>
            <div className={s.track}>
              <div className={s.fillWrap} style={{ width: w(L) }}>
                {common > 0 && <div className={s.solid} style={{ flexGrow: common, flexBasis: 0 }} />}
                {L - common > 0 && <div className={s.spare} style={{ flexGrow: L - common, flexBasis: 0 }} />}
              </div>
            </div>
            <b className={`${s.bVal} ${calc.leftTotal < 0 ? s.negTxt : ''}`}>{fmt(calc.leftTotal)}</b>
          </div>
          <div className={s.bRow}>
            <span className={s.bLab}>To be arrived</span>
            <div className={s.track}>
              <div className={s.fillWrap} style={{ width: w(A) }}>
                {common > 0 && <div className={s.hatch} style={{ flexGrow: common, flexBasis: 0 }} />}
                {A - common > 0 && <div className={s.short} style={{ flexGrow: A - common, flexBasis: 0 }} />}
              </div>
            </div>
            <b className={s.bVal}>{fmt(A)}</b>
          </div>
        </div>
        <ul className={s.key} aria-hidden="true">
          <li><i className={s.solid} />Left in hand</li>
          <li><i className={s.hatch} />To be arrived</li>
          <li><i className={s.short} />Short by</li>
          <li><i className={s.spare} />Space spare</li>
        </ul>
      </section>
    </div>
  );
}
