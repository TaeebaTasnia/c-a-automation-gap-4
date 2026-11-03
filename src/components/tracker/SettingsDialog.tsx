'use client';

import { useState } from 'react';
import { ALLOC, num, type Config } from '@/lib/logic';
import type { Tracker } from '@/lib/useTracker';
import Modal from './Modal';
import NumInput from './NumInput';
import s from './ui.module.css';

type Fields = Record<keyof Config, string>;
const PCT_KEYS = ALLOC.map((k) => ('pct_' + k.id) as keyof Config);

export default function SettingsDialog({ tr, onClose }: { tr: Tracker; onClose: () => void }) {
  const [f, setF] = useState<Fields>(() => {
    const o = {} as Fields;
    (Object.keys(tr.cfg) as (keyof Config)[]).forEach((k) => { o[k] = String(tr.cfg[k]); });
    return o;
  });
  const set = (k: keyof Config) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const total = PCT_KEYS.reduce((a, k) => a + num(f[k]), 0);
  const ok = total === 100;

  const save = async () => {
    const cfg = { ...tr.cfg } as Config;
    (Object.keys(f) as (keyof Config)[]).forEach((k) => { cfg[k] = num(f[k]); });
    if (await tr.saveConfig(cfg)) onClose();
  };
  const sample = () => { tr.loadSample(); onClose(); };

  return (
    <Modal title="Settings" hint="Allocation % applies to every week's forecast and is calculated live." onClose={onClose}>
      {ALLOC.map((k) => (
        <div className={s.frow} key={k.id}>
          <label>{k.name} allocation %</label>
          <NumInput dialog label={`${k.name} allocation percent`} value={f[('pct_' + k.id) as keyof Config]} onChange={set(('pct_' + k.id) as keyof Config)} />
        </div>
      ))}
      <p className={`${s.total} ${ok ? s.totalGood : s.totalBad}`} data-testid="pct-total" data-ok={ok}>
        Total: {total}%{ok ? '' : ' (should be 100%)'}
      </p>
      <div className={s.frow}>
        <label>FML default weekly forecast (TEUs)</label>
        <NumInput dialog label="FML default weekly forecast" value={f.fmlDefault} onChange={set('fmlDefault')} />
      </div>
      <div className={s.frow}>
        <label>CBM per TEU</label>
        <NumInput dialog label="CBM per TEU" value={f.cbmPerTeu} onChange={set('cbmPerTeu')} />
      </div>
      <hr className={s.rule} />
      <p className={s.dialogHint}>Want to see how it looks? Loads the Week 43–45 example (Oct 2026).</p>
      <button type="button" className={s.btn} onClick={sample}>Load sample data</button>
      <div className={s.dialogActions}>
        <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
        <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => { void save(); }}>Save</button>
      </div>
    </Modal>
  );
}
