'use client';

import { useState } from 'react';
import { calcWeek, status, type WeekStatus } from '@/lib/logic';
import { sanitizeNumeric } from '@/lib/sanitize';
import type { Tracker } from '@/lib/useTracker';
import s from './ui.module.css';

type Props = {
  t: Tracker;
  onExport: () => void;
  onSettings: () => void;
};

const DOT: Record<WeekStatus, string> = { deficit: s.dotDeficit, surplus: s.dotSurplus, balanced: s.dotBalanced };

export default function Toolbar({ t, onExport, onSettings }: Props) {
  const [addNo, setAddNo] = useState('');
  const submit = () => { if (t.addWeek(addNo)) setAddNo(''); };

  return (
    <nav className={s.toolbar} aria-label="Week selection and actions">
      <div className={s.toolbarInner}>
        <label className={s.fieldLabel}>
          Year
          <select className={s.field} value={t.sel.year} onChange={(e) => t.selectYear(Number(e.target.value))}>
            {t.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        <div className={s.chips} role="group" aria-label={`Weeks of ${t.sel.year}`}>
          {t.yearWeeks.length === 0 ? <span className={s.chipEmpty}>No weeks yet</span> : null}
          {t.yearWeeks.map((w) => {
            const c = calcWeek(w, t.cfg, t.daily);
            const st = status(c.deficit);
            const isSel = w.week === t.sel.week;
            const isNow = !!t.currentIso && t.currentIso.year === w.year && t.currentIso.week === w.week;
            const label = `Week ${w.week}, ${st}${st === 'balanced' ? '' : ' ' + Math.abs(Math.round(c.deficit))}${isNow ? ', current week' : ''}`;
            return (
              <button
                key={w.week}
                type="button"
                className={`${s.chip} ${isSel ? s.chipSel : ''}`}
                aria-pressed={isSel}
                aria-label={label}
                title={label}
                onClick={() => t.selectWeek(w.week)}
              >
                <span className={`${s.dot} ${DOT[st]}`} aria-hidden="true" />
                <span>W{w.week}</span>
                {isNow ? <span className={s.chipNow} aria-hidden="true">now</span> : null}
              </button>
            );
          })}
        </div>

        <button type="button" className={s.btn} onClick={t.currentWeek}>Current week</button>

        <div className={s.addGroup}>
          <input
            className={s.field}
            type="text"
            inputMode="numeric"
            placeholder="Week 1-53"
            aria-label="New week number"
            value={addNo}
            onChange={(e) => setAddNo(sanitizeNumeric(e.target.value).replace(/\./g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <button type="button" className={s.btn} onClick={submit}>Add week</button>
        </div>

        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={() => { void t.refresh(); }}>Refresh</button>
          <button type="button" className={s.btn} onClick={onExport}>Export</button>
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={onSettings}>Settings</button>
        </div>
      </div>
    </nav>
  );
}
