'use client';
import { CARRIERS, ALLOC, num, type WeekCalc, type Config, type CarrierId } from '@/lib/logic';
import s from './ShareBar.module.css';
import { pct } from './format';

const COLORS: Record<CarrierId, string> = {
  maersk: 'var(--c-maersk)', hapag: 'var(--c-hapag)', hellman: 'var(--c-hellman)', one: 'var(--c-one)', fml: 'var(--c-fml)',
};

type Seg = { id: CarrierId; name: string; frac: number };

function Stack({ segs, empty }: { segs: Seg[]; empty: string }) {
  const total = segs.reduce((a, x) => a + x.frac, 0);
  if (!(total > 0)) return <div className={`${s.stack} ${s.none}`}><span>{empty}</span></div>;
  return (
    <div className={s.stack}>
      {segs.filter((x) => x.frac > 0).map((x) => (
        <div key={x.id} className={s.seg} style={{ flexGrow: x.frac, background: COLORS[x.id] }} title={`${x.name} ${pct(x.frac / total)}`}>
          {x.frac / total >= 0.1 && <span>{Math.round((x.frac / total) * 100)}%</span>}
        </div>
      ))}
    </div>
  );
}

export default function ShareBar({ calc, cfg }: { calc: WeekCalc | null; cfg: Config }) {
  const target: Seg[] = ALLOC.map((k) => ({ id: k.id, name: k.name, frac: num(cfg[('pct_' + k.id) as keyof Config]) }));
  const actual: Seg[] = CARRIERS.map((k) => ({ id: k.id, name: k.name, frac: calc ? calc.share[k.id] || 0 : 0 }));
  const tText = target.map((x) => `${x.name} ${x.frac}%`).join(', ') + ', FML has no target';
  const aHas = actual.some((x) => x.frac > 0);
  const aText = aHas ? actual.map((x) => `${x.name} ${pct(x.frac)}`).join(', ') : 'no utilization recorded yet';
  return (
    <figure className={s.fig} aria-label={`Allocation gap. Target share: ${tText}. Actual share of used: ${aText}.`}>
      <div className={s.row}>
        <span className={s.lab}>Target share</span>
        <Stack segs={target} empty="No target set" />
      </div>
      <div className={s.row}>
        <span className={s.lab}>Actual share of used</span>
        <Stack segs={actual} empty="Nothing utilized yet" />
      </div>
      <figcaption>
        <ul className={s.legend}>
          {CARRIERS.map((k) => (
            <li key={k.id}>
              <span className={s.sw} style={{ background: COLORS[k.id] }} aria-hidden="true" />
              {k.name}
              <small>
                {k.id === 'fml' ? 'no target' : `target ${num(cfg[('pct_' + k.id) as keyof Config])}%`}
                {' · '}used {pct(calc ? calc.share[k.id] : null)}
              </small>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
