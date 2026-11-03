'use client';

import type { CSSProperties } from 'react';
import { CARRIERS, dayStats, dowName, fmtDate, type DailyRow } from '@/lib/logic';
import type { DailyField, Tracker } from '@/lib/useTracker';
import { fmt, pct, signed } from './visuals/format';
import NumInput from './NumInput';
import t from './tables.module.css';

const cc = (id: string) => ({ '--cc': `var(--c-${id})` }) as CSSProperties;
const vsText = (v: number | null) => (v == null ? '' : signed(v * 100) + '%');
const vsCls = (v: number | null) => (v == null || Math.round(v * 100) === 0 ? '' : v < 0 ? t.neg : t.pos);

export default function DailyTable({ tr }: { tr: Tracker }) {
  const { calc, selWeek, cfg, daily, today } = tr;
  if (!calc || !selWeek) return null;
  const tail = (n: number) => <td colSpan={n} />;
  // Week totals expressed as a pseudo day so dayStats gives total / TEUs / actual-vs-forecast.
  const totalRow: DailyRow = {
    date: 'total', maersk: calc.dsum.maersk, hapag: calc.dsum.hapag, hellman: calc.dsum.hellman, one: calc.dsum.one, fml: calc.dsum.fml,
    fcstCbm: calc.fcstCbm, actCbm: calc.actCbm > 0 ? calc.actCbm : '',
  };
  const tot = dayStats(totalRow, cfg);

  return (
    <div className={t.scroll} tabIndex={0} role="region" aria-label={`Week ${selWeek.week} date-wise table, scrolls horizontally`}>
      <table className={`${t.table} ${t.wideDaily}`}>
        <thead>
          <tr>
            <th scope="col" className={t.first}>Date</th>
            {CARRIERS.map((k) => <th key={k.id} scope="col" className={`${t.car} ${t.carSingle}`} style={cc(k.id)}>{k.name}</th>)}
            <th scope="col">Day total</th>
            <th scope="col">Forecast CBM</th>
            <th scope="col">Forecast TEUs</th>
            <th scope="col">Actual CBM</th>
            <th scope="col">Actual TEUs</th>
            <th scope="col">Act vs fcst</th>
          </tr>
        </thead>
        <tbody>
          {calc.dates.map((d) => {
            const r = daily[d];
            const st = dayStats(r, cfg);
            const isToday = d === today;
            const set = (f: DailyField) => (v: string) => tr.setDailyField(d, f, v);
            return (
              <tr key={d} className={isToday ? t.today : ''} aria-current={isToday ? 'date' : undefined}>
                <th scope="row" className={t.first}>
                  {fmtDate(d)}<span className={t.dow}>{dowName(d)}</span>
                  {isToday ? <span className={t.todayChip}>today</span> : null}
                </th>
                {CARRIERS.map((k) => (
                  <td key={k.id} className={t.inputCell}>
                    <NumInput label={`${fmtDate(d)} ${k.name} TEUs`} value={r?.[k.id]} onChange={set(k.id)} />
                  </td>
                ))}
                <td className={`${t.calc} ${t.calcPad}`}>{st.dayTotal ? fmt(st.dayTotal) : ''}</td>
                <td className={t.inputCell}><NumInput wide label={`${fmtDate(d)} forecast CBM`} value={r?.fcstCbm} onChange={set('fcstCbm')} /></td>
                <td className={`${t.calc} ${t.calcPad}`}>{st.fcstTeu ? fmt(st.fcstTeu, 1) : ''}</td>
                <td className={t.inputCell}><NumInput wide label={`${fmtDate(d)} actual CBM`} value={r?.actCbm} onChange={set('actCbm')} /></td>
                <td className={`${t.calc} ${t.calcPad}`}>{st.hasAct && st.actTeu ? fmt(st.actTeu, 1) : ''}</td>
                <td className={`${t.calc} ${t.calcPad} ${vsCls(st.vs)}`}>{vsText(st.vs)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={t.first}>Total utilized</th>
            {CARRIERS.map((k) => <td key={k.id}>{fmt(calc.dsum[k.id])}</td>)}
            <td>{fmt(tot.dayTotal)}</td>
            <td>{fmt(calc.fcstCbm)}</td>
            <td>{fmt(tot.fcstTeu, 1)}</td>
            <td>{fmt(calc.actCbm)}</td>
            <td>{fmt(tot.actTeu, 1)}</td>
            <td className={vsCls(tot.vs)}>{vsText(tot.vs)}</td>
          </tr>
          <tr>
            <th scope="row" className={t.first}>Confirmed</th>
            {CARRIERS.map((k) => <td key={k.id}>{fmt(calc.conf[k.id])}</td>)}
            <td>{fmt(calc.totalConf)}</td>{tail(5)}
          </tr>
          <tr>
            <th scope="row" className={t.first}>Utilized</th>
            {CARRIERS.map((k) => <td key={k.id}>{fmt(calc.util[k.id])}</td>)}
            <td>{fmt(calc.totalUtil)}</td>{tail(5)}
          </tr>
          <tr>
            <th scope="row" className={t.first}>Left</th>
            {CARRIERS.map((k) => (
              <td key={k.id} className={calc.left[k.id] < 0 ? t.neg : ''}>{calc.left[k.id] < 0 ? '−' + fmt(Math.abs(calc.left[k.id])) : fmt(calc.left[k.id])}</td>
            ))}
            <td className={calc.leftTotal < 0 ? t.neg : ''}>{calc.leftTotal < 0 ? '−' + fmt(Math.abs(calc.leftTotal)) : fmt(calc.leftTotal)}</td>{tail(5)}
          </tr>
          <tr>
            <th scope="row" className={t.first}>% utilized of confirmed</th>
            {CARRIERS.map((k) => <td key={k.id}>{pct(calc.pct[k.id])}</td>)}
            <td>{pct(calc.utilPct)}</td>{tail(5)}
          </tr>
          <tr>
            <th scope="row" className={t.first}>% share of total utilized</th>
            {CARRIERS.map((k) => <td key={k.id}>{pct(calc.share[k.id])}</td>)}
            <td>{calc.totalUtil > 0 ? '100%' : '—'}</td>{tail(5)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
