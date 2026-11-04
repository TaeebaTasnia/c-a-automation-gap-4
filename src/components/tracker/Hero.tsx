import { fmtDate } from '@/lib/logic';
import type { Tracker } from '@/lib/useTracker';
import PixelSea from './visuals/PixelSea';
import SavePill from './SavePill';
import ThemeToggle from './ThemeToggle';
import s from './ui.module.css';

export default function Hero({ t }: { t: Pick<Tracker, 'calc' | 'selWeek' | 'cfg' | 'saveState'> }) {
  const { calc, selWeek, cfg, saveState } = t;
  return (
    <header className={s.hero}>
      <PixelSea className={s.heroSea} />
      <div className={s.heroInner}>
        <div className={s.heroPanelOuter}>
          <div className={s.heroPanel}>
            <h1 className={s.title}>Carrier Allocation Tracker</h1>
            <p className={s.sub}>
              {calc && selWeek ? (
                <>
                  <b>Week {selWeek.week}</b> · {fmtDate(calc.dates[0])} to {fmtDate(calc.dates[6])} (Mon–Sun) · 1 TEU = {cfg.cbmPerTeu} CBM
                </>
              ) : (
                <>No week selected · 1 TEU = {cfg.cbmPerTeu} CBM</>
              )}
            </p>
          </div>
        </div>
        <div className={s.heroTools}>
          <SavePill state={saveState} className={s.heroPill} />
          <ThemeToggle className={s.heroToggle} />
        </div>
      </div>
    </header>
  );
}
