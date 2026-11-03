'use client';

/* State + actions for the tracker page. Wraps the autosave store (src/lib/store.ts).
 * - The store is created inside an effect (never at module level, no SSR localStorage access).
 * - `dataRef` is the synchronous source of truth for handlers; React state mirrors it for rendering.
 * - All numbers come from logic.ts (calcWeek / yearSummary).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CFG, calcWeek, isoWeekOf, newWeek, num, sampleData, yearSummary,
  type Config, type DailyMap, type DailyRow, type WeeklyRow,
} from './logic';
import { createStore, type Store, type StoreState } from './store';

export type Tab = 'allocation' | 'daily' | 'summary';
export type Data = { cfg: Config; weekly: WeeklyRow[]; daily: DailyMap };
export type Toast = { id: number; msg: string };
export type WeeklyField = Exclude<keyof WeeklyRow, 'year' | 'week'>;
export type DailyField = Exclude<keyof DailyRow, 'date'>;

const TAB_KEY = 'cat_tab';
const EMPTY: Data = { cfg: DEFAULT_CFG, weekly: [], daily: {} };

export function todayStr(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}
export const weekKey = (year: number, week: number) => year + '-' + week;
const sortWeeks = (a: WeeklyRow, b: WeeklyRow) => a.year - b.year || a.week - b.week;
const blankDay = (date: string): DailyRow => ({ date, maersk: '', hapag: '', hellman: '', one: '', fml: '', fcstCbm: '', actCbm: '' });

export function useTracker() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveState, setSaveState] = useState<StoreState>('loading');
  const [data, setData] = useState<Data>(EMPTY);
  const [sel, setSel] = useState<{ year: number; week: number }>({ year: 0, week: 0 });
  const [today, setToday] = useState('');
  const [tab, setTabState] = useState<Tab>('allocation');
  const [toast, setToast] = useState<Toast | null>(null);
  const [armedDel, setArmedDel] = useState<string | null>(null);

  const storeRef = useRef<Store | null>(null);
  const dataRef = useRef<Data>(EMPTY);
  const selRef = useRef(sel);
  const todayRef = useRef('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);
  const armedDelRef = useRef<string | null>(null);

  const commit = useCallback((next: Data) => { dataRef.current = next; setData(next); }, []);
  const select = useCallback((s: { year: number; week: number }) => { selRef.current = s; setSel(s); }, []);

  const showToast = useCallback((msg: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const lastWeekOf = (weekly: WeeklyRow[], year: number): number => {
    const ws = weekly.filter((w) => w.year === year).sort(sortWeeks);
    return ws.length ? ws[ws.length - 1].week : 0;
  };

  /** Apply freshly loaded data. `keepSel` keeps the current selection when it still exists. */
  const applyLoaded = useCallback((d: Data, keepSel: boolean) => {
    commit(d);
    const t = todayStr();
    todayRef.current = t;
    setToday(t);
    const cur = isoWeekOf(t);
    const has = (y: number, w: number) => d.weekly.some((r) => r.year === y && r.week === w);
    const s = selRef.current;
    if (keepSel && s.year && has(s.year, s.week)) return;
    if (has(cur.year, cur.week)) select({ year: cur.year, week: cur.week });
    else if (d.weekly.length) {
      const inYear = lastWeekOf(d.weekly, cur.year);
      if (inYear) select({ year: cur.year, week: inYear });
      else {
        const sorted = d.weekly.slice().sort(sortWeeks);
        const last = sorted[sorted.length - 1];
        select({ year: last.year, week: last.week });
      }
    } else select({ year: cur.year, week: 0 });
  }, [commit, select]);

  // ---- mount: create the store, load ----
  useEffect(() => {
    let cancelled = false;
    const store = createStore({ onState: (s) => { if (!cancelled) setSaveState(s); } });
    storeRef.current = store;
    store.load().then((d) => {
      if (cancelled) return;
      applyLoaded({ cfg: d.config, weekly: d.weekly, daily: d.daily }, false);
      try {
        const t = window.localStorage.getItem(TAB_KEY);
        if (t === 'allocation' || t === 'daily' || t === 'summary') setTabState(t);
      } catch { /* storage unavailable */ }
      setStatus('ready');
    }).catch((e: unknown) => {
      if (cancelled) return;
      setStatus('error');
      showToast('Could not load data: ' + (e instanceof Error ? e.message : String(e)));
    });
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (storeRef.current && storeRef.current.hasUnsaved()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, [applyLoaded, showToast]);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    try { window.localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ }
  }, []);

  // ---- derived ----
  const { cfg, weekly, daily } = data;
  const yearWeeks = useMemo(() => weekly.filter((w) => w.year === sel.year).sort(sortWeeks), [weekly, sel.year]);
  const years = useMemo(() => {
    const s = new Set<number>(weekly.map((w) => w.year));
    if (sel.year) s.add(sel.year);
    if (today) s.add(isoWeekOf(today).year);
    return Array.from(s).sort((a, b) => a - b);
  }, [weekly, sel.year, today]);
  const selWeek = useMemo(() => yearWeeks.find((w) => w.week === sel.week) || null, [yearWeeks, sel.week]);
  const calc = useMemo(() => (selWeek ? calcWeek(selWeek, cfg, daily) : null), [selWeek, cfg, daily]);
  const summary = useMemo(() => yearSummary(yearWeeks, cfg, daily), [yearWeeks, cfg, daily]);
  const currentIso = useMemo(() => (today ? isoWeekOf(today) : null), [today]);

  // ---- actions ----
  const selectYear = useCallback((year: number) => {
    select({ year, week: lastWeekOf(dataRef.current.weekly, year) });
    armedDelRef.current = null;
    setArmedDel(null);
  }, [select]);

  const selectWeek = useCallback((week: number) => {
    select({ year: selRef.current.year, week });
    armedDelRef.current = null;
    setArmedDel(null);
  }, [select]);

  const currentWeek = useCallback(() => {
    const cur = isoWeekOf(todayRef.current || todayStr());
    if (dataRef.current.weekly.some((w) => w.year === cur.year && w.week === cur.week)) {
      select({ year: cur.year, week: cur.week });
    } else {
      select({ year: cur.year, week: lastWeekOf(dataRef.current.weekly, cur.year) });
      showToast(`Week ${cur.week} isn't set up yet. Add it with Add week`);
    }
  }, [select, showToast]);

  const addWeek = useCallback((raw: string): boolean => {
    const n = Number(raw);
    if (!raw.trim() || !Number.isInteger(n) || n < 1 || n > 53) {
      showToast('Enter a week number between 1 and 53');
      return false;
    }
    const year = selRef.current.year;
    const d = dataRef.current;
    if (d.weekly.some((w) => w.year === year && w.week === n)) {
      select({ year, week: n });
      showToast(`Week ${n} already exists for ${year}`);
      return false;
    }
    const row = newWeek(year, n, d.cfg);
    storeRef.current?.markWeek(row);
    commit({ ...d, weekly: d.weekly.concat(row).sort(sortWeeks) });
    select({ year, week: n });
    return true;
  }, [commit, select, showToast]);

  const deleteWeek = useCallback((year: number, week: number) => {
    const key = weekKey(year, week);
    if (armTimer.current) clearTimeout(armTimer.current);
    if (armedDelRef.current !== key) {
      armedDelRef.current = key;
      setArmedDel(key);
      armTimer.current = setTimeout(() => { armedDelRef.current = null; setArmedDel(null); }, 3000);
      return;
    }
    armedDelRef.current = null;
    setArmedDel(null);
    const d = dataRef.current;
    const weeklyLeft = d.weekly.filter((w) => !(w.year === year && w.week === week));
    commit({ ...d, weekly: weeklyLeft });
    if (selRef.current.year === year && selRef.current.week === week) select({ year, week: lastWeekOf(weeklyLeft, year) });
    const st = storeRef.current;
    if (st) {
      st.deleteWeek(year, week).then(
        () => showToast(`Week ${week} deleted (date-wise rows are kept)`),
        (e: unknown) => showToast('Delete failed: ' + (e instanceof Error ? e.message : String(e))),
      );
    }
  }, [commit, select, showToast]);

  const setWeeklyField = useCallback((year: number, week: number, field: WeeklyField, value: string) => {
    const d = dataRef.current;
    const i = d.weekly.findIndex((w) => w.year === year && w.week === week);
    if (i < 0) return;
    const row = { ...d.weekly[i], [field]: value } as WeeklyRow;
    const weekly2 = d.weekly.slice();
    weekly2[i] = row;
    storeRef.current?.markWeek(row);
    commit({ ...d, weekly: weekly2 });
  }, [commit]);

  const setDailyField = useCallback((date: string, field: DailyField, value: string) => {
    const d = dataRef.current;
    const row: DailyRow = { ...(d.daily[date] || blankDay(date)), [field]: value };
    storeRef.current?.markDaily(row);
    commit({ ...d, daily: { ...d.daily, [date]: row } });
  }, [commit]);

  const saveConfig = useCallback(async (next: Config): Promise<boolean> => {
    if (!(num(next.cbmPerTeu) > 0)) { showToast('CBM per TEU must be above 0'); return false; }
    try {
      await storeRef.current?.saveConfig(next);
      commit({ ...dataRef.current, cfg: next });
      showToast('Settings saved');
      return true;
    } catch (e) {
      showToast('Could not save settings: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }, [commit, showToast]);

  const loadSample = useCallback(() => {
    const d = dataRef.current;
    const s = sampleData(d.cfg);
    const weekly2 = d.weekly.slice();
    s.weekly.forEach((r) => {
      const i = weekly2.findIndex((x) => x.year === r.year && x.week === r.week);
      if (i < 0) weekly2.push(r); else weekly2[i] = r;
      storeRef.current?.markWeek(r);
    });
    const daily2: DailyMap = { ...d.daily };
    s.daily.forEach((r) => { daily2[r.date] = r; storeRef.current?.markDaily(r); });
    commit({ ...d, weekly: weekly2.sort(sortWeeks), daily: daily2 });
    select({ year: 2026, week: 43 });
    showToast('Sample data loaded');
  }, [commit, select, showToast]);

  const refresh = useCallback(async () => {
    const st = storeRef.current;
    if (!st) return;
    try {
      await st.flush();
      const d = await st.refresh();
      applyLoaded({ cfg: d.config, weekly: d.weekly, daily: d.daily }, true);
      showToast('Reloaded from storage');
    } catch (e) {
      showToast('Could not load data: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [applyLoaded, showToast]);

  return {
    status, saveState, cfg, weekly, daily, sel, today, tab, toast, armedDel,
    yearWeeks, years, selWeek, calc, summary, currentIso,
    setTab, selectYear, selectWeek, currentWeek, addWeek, deleteWeek,
    setWeeklyField, setDailyField, saveConfig, loadSample, refresh, showToast,
  };
}

export type Tracker = ReturnType<typeof useTracker>;
