'use client';

import { buildDatasets } from '@/lib/exports';
import type { Tracker } from '@/lib/useTracker';
import { todayStr } from '@/lib/useTracker';
import { copyText, downloadCsv } from './download';
import Modal from './Modal';
import s from './ui.module.css';

export default function ExportDialog({ tr, onClose }: { tr: Tracker; onClose: () => void }) {
  const sets = buildDatasets(tr.weekly, tr.cfg, tr.daily, tr.today || todayStr());

  const download = (i: number) => {
    const d = sets[i];
    if (downloadCsv(d.fileName, d.csv)) tr.showToast(`Downloading ${d.fileName}`);
    else tr.showToast('Download blocked by browser. Use the Copy button instead');
  };
  const copy = async (i: number) => {
    const ok = await copyText(sets[i].tsv);
    tr.showToast(ok ? 'Copied. Paste into Excel or Google Sheets' : 'Copy blocked by the browser. Use Download CSV');
  };
  const both = () => {
    sets.forEach((d, i) => { setTimeout(() => downloadCsv(d.fileName, d.csv), i * 400); });
    tr.showToast('Downloading both files');
  };

  return (
    <Modal title="Export data" hint="CSV files open directly in Excel or Google Sheets. Includes every year, not just the selected one." onClose={onClose}>
      {sets.map((d, i) => (
        <section key={d.id} className={s.dataset} aria-label={d.title}>
          <h3>{d.title}</h3>
          <p>{d.desc}</p>
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => download(i)}>Download CSV</button>
            <button type="button" className={s.btn} onClick={() => { void copy(i); }}>Copy</button>
          </div>
        </section>
      ))}
      <div className={s.dialogActions}>
        <button type="button" className={s.btn} onClick={both}>Download both</button>
        <button type="button" className={s.btn} onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
