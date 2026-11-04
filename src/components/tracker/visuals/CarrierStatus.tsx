'use client';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CARRIERS, type CarrierId, type Config, type DailyMap, type WeekCalc, type WeeklyRow } from '@/lib/logic';
import CarrierCards from './CarrierCards';
import CarrierDetail from './CarrierDetail';
import { pct } from './format';
import s from './CarrierStatus.module.css';

const COLORS: Record<CarrierId, string> = {
  maersk: 'var(--c-maersk)', hapag: 'var(--c-hapag)', hellman: 'var(--c-hellman)', one: 'var(--c-one)', fml: 'var(--c-fml)',
};
const CLOSE_MS = 180;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Phase = 'closed' | 'opening' | 'open' | 'closing';

function Warn() {
  return (
    <svg className={s.warn} viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M7 1 13 13H1z" fill="currentColor" />
      <rect x="6" y="5" width="2" height="4" fill="var(--surface)" />
      <rect x="6" y="10" width="2" height="2" fill="var(--surface)" />
    </svg>
  );
}

/** Collapsible carrier status: trigger + at-a-glance chips, and an overlay pop-up holding the five carrier cards. */
export default function CarrierStatus({ week, calc, cfg, daily, today }: { week: WeeklyRow; calc: WeekCalc; cfg: Config; daily?: DailyMap; today?: string }) {
  const uid = useId();
  const panelId = `carrier-panel-${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  const titleId = `${panelId}-t`;
  const [phase, setPhase] = useState<Phase>('closed');
  const [view, setView] = useState<'all' | CarrierId>('all');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const mounted = phase !== 'closed';
  const shown = phase === 'opening' || phase === 'open';

  const open = useCallback(() => setPhase((p) => (p === 'open' || p === 'opening' ? p : 'opening')), []);
  const close = useCallback((refocus: boolean) => {
    setPhase((p) => (p === 'closed' || p === 'closing' ? p : 'closing'));
    if (refocus) triggerRef.current?.focus();
  }, []);

  // opening -> open on the next paint so the starting styles are committed first
  useEffect(() => {
    if (phase !== 'opening') return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setPhase('open')); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [phase]);

  // closing -> closed after the exit transition
  useEffect(() => {
    if (phase !== 'closing') return;
    const t = window.setTimeout(() => { setPhase('closed'); setView('all'); }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Esc and outside click while shown
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [shown, close]);

  // move focus into the panel when it opens
  const wasShown = useRef(false);
  useEffect(() => {
    if (shown && !wasShown.current) panelRef.current?.focus({ preventScroll: true });
    wasShown.current = shown;
  }, [shown]);

  // each view starts at the top of the panel
  useEffect(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = 0; }, [view]);

  const onTrigger = () => { if (shown) close(false); else { setView('all'); open(); } };
  const onChip = (id: CarrierId) => {
    if (shown && view === id) { setView('all'); return; }
    setView(id);
    open();
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) { e.preventDefault(); return; }
    const a = items[0], z = items[items.length - 1];
    const cur = document.activeElement;
    if (e.shiftKey && (cur === a || cur === panelRef.current)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
  };

  const overIds = CARRIERS.filter((k) => { const p = calc.pct[k.id]; return p != null && p > 1; });
  const summary = overIds.length
    ? `${overIds.length} over 100%`
    : 'All within 100%';

  return (
    <section className={s.root} ref={rootRef} aria-label="Carrier status">
      <div className={`${s.bar} ${shown ? s.barOpen : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className={s.trigger}
          aria-expanded={shown}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={onTrigger}
        >
          <span className={s.tTitle}>Carrier status</span>
          <span className={`${s.tSum} ${overIds.length ? s.tSumBad : ''}`}>
            {overIds.length ? <Warn /> : null}
            {CARRIERS.length} carriers · {summary}
          </span>
          <svg className={`${s.chev} ${shown ? s.chevOpen : ''}`} viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
            <path d="M2 5h2v2h2v2h4V7h2V5h2v2h-2v2h-2v2H6V9H4V7H2z" fill="currentColor" />
          </svg>
        </button>
        <ul className={s.strip} aria-label={`Utilization by carrier, week ${week.week}`}>
          {CARRIERS.map((k) => {
            const p = calc.pct[k.id];
            const over = p != null && p > 1;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  className={`${s.glance} ${over ? s.glanceBad : ''} ${shown && view === k.id ? s.glanceOn : ''}`}
                  style={{ ['--c' as string]: COLORS[k.id] }}
                  aria-controls={panelId}
                  aria-haspopup="dialog"
                  aria-pressed={shown && view === k.id}
                  aria-label={`${k.name}: ${p == null ? 'no utilization' : `${Math.round(p * 100)}% utilized${over ? ', over 100%' : ''}`}. Show details`}
                  onClick={() => onChip(k.id)}
                >
                  <span className={s.sw} aria-hidden="true" />
                  <span className={s.gName}>{k.name}</span>
                  <span className={s.gPct}>{over ? <Warn /> : null}{pct(p)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {mounted ? (
        <div
          id={panelId}
          ref={panelRef}
          className={s.panel}
          data-phase={phase}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onPanelKey}
        >
          <span className={s.notch} aria-hidden="true" />
          <div className={s.scroller} ref={scrollerRef}>
            <header className={s.head}>
              <div className={s.headText}>
                {view !== 'all' ? (
                  <button type="button" className={s.back} onClick={() => setView('all')}>
                    <span aria-hidden="true">←</span> All carriers
                  </button>
                ) : null}
                <h2 id={titleId} className={s.title}>{view === 'all' ? 'Carrier status' : (CARRIERS.find((k) => k.id === view)?.name ?? '')} <span className={s.weekLbl}>Week {week.week}, {week.year}</span></h2>
                <ul className={s.legend} aria-label="Legend">
                  <li><i className={s.lgOn} aria-hidden="true" />Share of confirmed TEUs utilized</li>
                  <li><i className={s.lgOver} aria-hidden="true" />Red = over 100%</li>
                </ul>
              </div>
              <button ref={closeBtnRef} type="button" className={s.close} onClick={() => close(true)} aria-label="Close carrier status">
                <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
                  <path d="M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z" fill="currentColor" />
                </svg>
                <span>Close</span>
              </button>
            </header>
            <div className={s.swap} key={view} data-view={view}>
              {view === 'all' ? (
                <CarrierCards week={week} calc={calc} cfg={cfg} staged />
              ) : (
                <CarrierDetail id={view} calc={calc} cfg={cfg} daily={daily} today={today} weekKey={`${week.year}-${week.week}`} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
