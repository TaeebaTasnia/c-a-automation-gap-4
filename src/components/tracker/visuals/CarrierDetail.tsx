'use client';
import { useState } from 'react';
import { CARRIERS, dowName, num, type CarrierId, type Config, type DailyMap, type WeekCalc } from '@/lib/logic';
import { pieSegments, slicePct } from '@/lib/pie';
import { Card } from './CarrierCards';
import { fmt } from './format';
import s from './CarrierDetail.module.css';

const COLORS: Record<CarrierId, string> = {
  maersk: 'var(--c-maersk)', hapag: 'var(--c-hapag)', hellman: 'var(--c-hellman)', one: 'var(--c-one)', fml: 'var(--c-fml)',
};
const R = 40;
const C = 2 * Math.PI * R;
const SWEEP_MS = 600;

type Slice = { label: string; value: number; color: string };

const f1 = (n: number) => fmt(n, Number.isInteger(n) ? 0 : 1);

function Pie({ title, slices, empty, note, shown }: {
  title: string; slices: Slice[]; empty: string; note?: string; shown?: string[];
}) {
  const [hov, setHov] = useState<number | null>(null);
  const segs = pieSegments(slices.map((x) => x.value), C);
  const isEmpty = segs.length === 0;
  const val = (i: number) => shown?.[i] ?? f1(slices[i].value);
  const aria = isEmpty
    ? `${title}: ${empty}`
    : `${title}: ${slices.map((x, i) => `${x.label} ${val(i)} (${slicePct(segs[i].frac)})`).join(', ')}`;
  return (
    <figure className={s.pieFig} data-pie={title}>
      <figcaption className={s.pieTitle}>{title}</figcaption>
      <div className={s.pieBox}>
        <svg viewBox="0 0 160 160" className={s.pie} role="img" aria-label={aria}>
          {isEmpty ? (
            <circle cx="80" cy="80" r="76" className={s.emptyRing} />
          ) : (
            <g transform="rotate(-90 80 80)">
              {segs.map((g, i) => g.len > 0 && (
                <circle
                  key={i}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={slices[i].color}
                  strokeWidth={2 * R}
                  data-slice={slices[i].label}
                  data-value={slices[i].value}
                  className={`${s.slice} ${hov === i ? s.sliceHot : ''}`}
                  style={{ strokeDasharray: `${g.len} ${C - g.len}`, strokeDashoffset: g.offset, ['--C' as string]: C, ['--dur' as string]: `${Math.max(80, g.frac * SWEEP_MS)}ms`, ['--delay' as string]: `${g.start * SWEEP_MS}ms` }}
                  tabIndex={0}
                  onPointerEnter={() => setHov(i)}
                  onPointerLeave={() => setHov(null)}
                  onFocus={() => setHov(i)}
                  onBlur={() => setHov(null)}
                />
              ))}
            </g>
          )}
          <circle cx="80" cy="80" r="79" fill="none" className={s.pieEdge} />
        </svg>
        {hov != null && segs[hov] ? (
          <div className={s.tip} role="status">
            <b>{slices[hov].label}</b> {val(hov)} · {slicePct(segs[hov].frac)}
          </div>
        ) : null}
        {note ? <span className={s.badge}>{note}</span> : null}
      </div>
      {isEmpty ? (
        <p className={s.emptyMsg}>{empty}</p>
      ) : (
        <ul className={s.pieLegend}>
          {slices.map((x, i) => (
            <li key={x.label}>
              <i style={{ background: x.color }} aria-hidden="true" />
              <span>{x.label}</span>
              <b>{val(i)}</b>
              <small>{slicePct(segs[i].frac)}</small>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function DailyStrip({ id, calc, daily, today }: { id: CarrierId; calc: WeekCalc; daily?: DailyMap; today?: string }) {
  const vals = calc.dates.map((d) => ({ d, v: num(daily?.[d]?.[id]), has: !!daily?.[d] }));
  const any = vals.some((x) => x.has);
  const max = Math.max(1, ...vals.map((x) => x.v));
  return (
    <section className={s.daily} aria-label="Daily TEUs this week">
      <h4 className={s.dTitle}>Daily TEUs this week</h4>
      {!any ? (
        <p className={s.emptyMsg}>No daily entries yet</p>
      ) : (
        <ol className={s.days}>
          {vals.map((x) => (
            <li key={x.d} className={`${s.day} ${x.d === today ? s.dayNow : ''}`} aria-label={`${dowName(x.d)} ${fmt(x.v)} TEU${x.d === today ? ', today' : ''}`}>
              <span className={s.dVal}>{fmt(x.v)}</span>
              <span className={s.dTrack}>
                <span className={s.dBar} style={{ height: `${Math.round((x.v / max) * 100)}%`, background: COLORS[id] }} />
              </span>
              <span className={s.dLbl}>{dowName(x.d)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** One carrier: its card, two pies (confirmed capacity, share of total used) and a daily strip. */
export default function CarrierDetail({ id, calc, cfg, daily, today, weekKey }: {
  id: CarrierId; calc: WeekCalc; cfg: Config; daily?: DailyMap; today?: string; weekKey: string;
}) {
  const k = CARRIERS.find((c) => c.id === id) ?? CARRIERS[0];
  const conf = calc.conf[id];
  const util = calc.util[id];
  const over = conf > 0 && util > conf;
  const confSlices: Slice[] = over
    ? [{ label: 'Utilized', value: conf, color: 'var(--bad)' }]
    : [{ label: 'Utilized', value: util, color: COLORS[id] }, { label: 'Left', value: Math.max(0, conf - util), color: 'var(--v-grid)' }];
  const shareSlices: Slice[] = [
    { label: k.name, value: util, color: COLORS[id] },
    { label: 'Other carriers', value: Math.max(0, calc.totalUtil - util), color: 'var(--v-grid)' },
  ];
  return (
    <div className={s.detail} data-detail={id}>
      <div className={s.cardCol}>
        <Card key={weekKey} k={k} i={0} calc={calc} cfg={cfg} hl={false} />
      </div>
      <div className={s.right}>
        <div className={s.pies}>
          <Pie
            title="Confirmed capacity"
            slices={confSlices}
            empty="No confirmed TEUs yet"
            note={over ? `Over by ${f1(util - conf)} TEU` : undefined}
            shown={over ? [`${f1(util)} of ${f1(conf)}`] : undefined}
          />
          <Pie title="Share of total used" slices={shareSlices} empty="Nothing utilized yet" />
        </div>
        <DailyStrip id={id} calc={calc} daily={daily} today={today} />
      </div>
    </div>
  );
}
