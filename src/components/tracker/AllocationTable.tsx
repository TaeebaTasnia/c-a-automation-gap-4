'use client';

import type { CSSProperties } from 'react';
import { CARRIERS, calcWeek } from '@/lib/logic';
import { weekKey, type Tracker, type WeeklyField } from '@/lib/useTracker';
import { fmt } from './visuals/format';
import NumInput from './NumInput';
import t from './tables.module.css';
import u from './ui.module.css';

const cc = (id: string) => ({ '--cc': `var(--c-${id})` }) as CSSProperties;

export default function AllocationTable({ tr }: { tr: Tracker }) {
  return (
    <div className={t.scroll} tabIndex={0} role="region" aria-label="Weekly allocation table, scrolls horizontally">
      <table className={`${t.table} ${t.wideAlloc}`}>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={t.first}>Week</th>
            <th scope="col" rowSpan={2}>TEUs +25%</th>
            {CARRIERS.map((k) => (
              <th key={k.id} scope="colgroup" colSpan={3} className={t.car} style={cc(k.id)}>{k.name}</th>
            ))}
            <th scope="col" rowSpan={2}><span className={u.srOnly}>Delete</span></th>
          </tr>
          <tr>
            {CARRIERS.map((k) => (
              ['Forecast', 'Confirmed', 'Utilized'].map((h) => <th key={k.id + h} scope="col">{h}</th>)
            ))}
          </tr>
        </thead>
        <tbody>
          {tr.yearWeeks.map((w) => {
            const c = calcWeek(w, tr.cfg, tr.daily);
            const isSel = w.week === tr.sel.week;
            const isNow = !!tr.currentIso && tr.currentIso.year === w.year && tr.currentIso.week === w.week;
            const key = weekKey(w.year, w.week);
            const armed = tr.armedDel === key;
            const set = (f: WeeklyField) => (v: string) => tr.setWeeklyField(w.year, w.week, f, v);
            return (
              <tr key={key} className={`${t.row} ${isSel ? t.sel : ''}`} onClick={() => tr.selectWeek(w.week)} aria-selected={isSel}>
                <th scope="row" className={`${t.first}`}>
                  {w.week}{isNow ? <span className={t.nowChip}>now</span> : null}
                </th>
                <td className={t.inputCell}>
                  <NumInput wide label={`Week ${w.week} total forecast TEUs`} value={w.forecast} onChange={set('forecast')} />
                </td>
                {CARRIERS.map((k) => {
                  const confF = (k.id + '_conf') as WeeklyField;
                  const utilF = (k.id + '_util') as WeeklyField;
                  return [
                    k.id === 'fml' ? (
                      <td key={k.id + 'f'} className={`${t.inputCell} ${t.carStart}`}>
                        <NumInput label={`Week ${w.week} FML forecast`} value={w.fml_fcst} onChange={set('fml_fcst')} />
                      </td>
                    ) : (
                      <td key={k.id + 'f'} className={`${t.calc} ${t.calcPad} ${t.carStart}`} title="Calculated from the total forecast and allocation %">{fmt(c.fc[k.id])}</td>
                    ),
                    <td key={k.id + 'c'} className={t.inputCell}>
                      <NumInput label={`Week ${w.week} ${k.name} confirmed`} value={w[confF]} onChange={set(confF)} />
                    </td>,
                    c.fromDaily[k.id] ? (
                      <td key={k.id + 'u'} className={`${t.calc} ${t.calcPad}`} title="Calculated from the date-wise table">{fmt(c.util[k.id])}</td>
                    ) : (
                      <td key={k.id + 'u'} className={t.inputCell}>
                        <NumInput label={`Week ${w.week} ${k.name} utilized`} value={w[utilF]} onChange={set(utilF)} />
                      </td>
                    ),
                  ];
                })}
                <td>
                  <button
                    type="button"
                    className={`${t.del} ${armed ? t.armed : ''}`}
                    aria-label={armed ? `Confirm delete week ${w.week}` : `Delete week ${w.week}`}
                    onClick={(e) => { e.stopPropagation(); tr.deleteWeek(w.year, w.week); }}
                  >
                    {armed ? 'Sure?' : '✕'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
