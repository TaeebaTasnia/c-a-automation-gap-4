'use client';

import { useState } from 'react';
import { buildRangeExport } from '@/lib/exports';
import type { Tracker } from '@/lib/useTracker';
import { copyText, downloadCsv } from './download';
import s from './ui.module.css';
import p from './export.module.css';

export default function ExportPanel({ tr }: { tr: Tracker }) {
  const nums = tr.yearWeeks.map((w) => w.week);
  const [range, setRange] = useState<{ from: number; to: number }>({ from: 0, to: 0 });
  // Fall back to the full range when the stored choice is not in this year's weeks.
  const from = nums.includes(range.from) ? range.from : nums[0];
  const to = nums.includes(range.to) ? Math.max(range.to, from) : nums[nums.length - 1];

  if (!nums.length) {
    return <p className={p.none}>No weeks to export yet.</p>;
  }
  const build = () => buildRangeExport(tr.weekly, tr.sel.year, from, to, tr.cfg, tr.daily);
  const count = nums.filter((n) => n >= from && n <= to).length;

  const onFrom = (v: number) => setRange({ from: v, to: Math.max(v, to) });
  const onTo = (v: number) => setRange({ from: Math.min(v, from), to: v });

  const download = () => {
    const e = build();
    if (!e.count) { tr.showToast('No weeks in that range'); return; }
    if (downloadCsv(e.fileName, e.csv)) tr.showToast(`Downloading ${e.count} week${e.count === 1 ? '' : 's'}...`);
    else tr.showToast('Download blocked by browser. Use the Copy button instead');
  };
  const copy = async () => {
    const e = build();
    if (!e.count) { tr.showToast('No weeks in that range'); return; }
    const ok = await copyText(e.tsv);
    tr.showToast(ok ? 'Copied. Paste into Excel or Google Sheets' : 'Copy blocked by the browser. Use Download CSV');
  };

  return (
    <div className={p.panel}>
      <label className={s.fieldLabel}>
        From
        <select className={s.field} value={from} onChange={(e) => onFrom(Number(e.target.value))}>
          {nums.map((n) => <option key={n} value={n}>Week {n}</option>)}
        </select>
      </label>
      <label className={s.fieldLabel}>
        To
        <select className={s.field} value={to} onChange={(e) => onTo(Number(e.target.value))}>
          {nums.map((n) => <option key={n} value={n}>Week {n}</option>)}
        </select>
      </label>
      <span className={p.count}>{tr.sel.year} · {count} week{count === 1 ? '' : 's'}</span>
      <button type="button" className={`${s.btn} ${s.primary}`} onClick={download}>Download CSV</button>
      <button type="button" className={s.btn} onClick={() => { void copy(); }}>Copy for Excel / Sheets</button>
    </div>
  );
}
