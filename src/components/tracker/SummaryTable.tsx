'use client';

import type { CSSProperties } from 'react';
import { CARRIERS, num, status } from '@/lib/logic';
import type { Tracker } from '@/lib/useTracker';
import { fmt, pct, signed } from './visuals/format';
import t from './tables.module.css';

const cc = (id: string) => ({ '--cc': `var(--c-${id})` }) as CSSProperties;
const cls = (st: ReturnType<typeof status>) => (st === 'deficit' ? t.neg : st === 'surplus' ? t.pos : '');
const word = (st: ReturnType<typeof status>) => (st === 'deficit' ? 'deficit' : st === 'surplus' ? 'surplus' : 'balanced');

export default function SummaryTable({ tr }: { tr: Tracker }) {
  const { summary } = tr;
  const total = summary.total;
  const tst = status(total.d);
  return (
    <div className={t.scroll} tabIndex={0} role="region" aria-label={`Weekly summary for ${tr.sel.year}, scrolls horizontally`}>
      <table className={`${t.table} ${t.wideSummary}`}>
        <thead>
          <tr>
            <th scope="col" className={t.first}>Week</th>
            <th scope="col">Forecast</th>
            <th scope="col">Total confirmed</th>
            <th scope="col">Total utilized</th>
            <th scope="col">Util %</th>
            <th scope="col">To be arrived</th>
            <th scope="col">Left in hand / To be utilized</th>
            <th scope="col">Deficit / surplus</th>
            <th scope="col">CBM +25%</th>
            <th scope="col">TEUs</th>
            {CARRIERS.map((k) => <th key={k.id} scope="col" className={`${t.car} ${t.carSingle}`} style={cc(k.id)}>{k.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {summary.rows.map(({ week: w, c }) => {
            const st = status(c.deficit);
            const isNow = !!tr.currentIso && tr.currentIso.year === w.year && tr.currentIso.week === w.week;
            return (
              <tr key={w.week} className={`${t.row} ${t.summaryRow} ${w.week === tr.sel.week ? t.sel : ''}`} onClick={() => tr.selectWeek(w.week)}>
                <th scope="row" className={t.first}>{w.week}{isNow ? <span className={t.nowChip}>now</span> : null}</th>
                <td>{fmt(num(w.forecast))}</td>
                <td>{fmt(c.totalConf)}</td>
                <td>{fmt(c.totalUtil)}</td>
                <td>{pct(c.utilPct)}</td>
                <td>{fmt(c.toBeArrived)}</td>
                <td>{fmt(c.leftTotal)}</td>
                <td className={cls(st)}>{signed(c.deficit)}<span className={t.word}>{word(st)}</span></td>
                <td>{fmt(c.cbmPlan)}</td>
                <td>{fmt(num(w.forecast))}</td>
                {CARRIERS.map((k) => <td key={k.id}>{fmt(c.fc[k.id])}</td>)}
              </tr>
            );
          })}
        </tbody>
        {summary.rows.length > 1 ? (
          <tfoot>
            <tr>
              <th scope="row" className={t.first}>Year total</th>
              <td>{fmt(total.f)}</td>
              <td>{fmt(total.c)}</td>
              <td>{fmt(total.u)}</td>
              <td>{total.c > 0 ? pct(total.u / total.c) : '—'}</td>
              <td>{fmt(total.a)}</td>
              <td>{fmt(total.l)}</td>
              <td className={cls(tst)}>{signed(total.d)}<span className={t.word}>{word(tst)}</span></td>
              <td colSpan={2 + CARRIERS.length} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
