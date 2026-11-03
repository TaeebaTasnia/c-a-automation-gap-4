/* Persistence adapter + autosave controller. Ported 1:1 from js/tracker/store.js.
 *
 *   createStore({backend, delay=1100, onState, setTimeoutFn, clearTimeoutFn}) -> Store
 *   localBackend(storageLike?, key='cat_db') -> Backend   (localStorage is resolved lazily inside methods: SSR safe)
 *
 * Backend shape: {getAll(), saveConfig(cfg), saveWeekly(rows), deleteWeek(year, week), saveDaily(rows)}
 * (each returns a Promise). Swapping `backend` for a Google Apps Script `google.script.run` / Sheets
 * backend is the intended production path (BRD platform); the shape is the same as prev's `api_*`
 * functions (api_getAll, api_saveConfig, api_saveWeekly, api_deleteWeek, api_saveDaily).
 *
 * store.state: 'loading' | 'dirty' | 'saving' | 'saved' | 'error'; onState(state, message) on every change.
 */
import {
  DEFAULT_CFG, WEEKLY_KEYS, num, sampleData,
  type Config, type DailyMap, type DailyRow, type WeeklyRow,
} from './logic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type StoreState = 'loading' | 'dirty' | 'saving' | 'saved' | 'error';
export type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };

/** Raw data as held by a backend (daily as an array of rows). */
export type BackendData = { config?: Partial<Config>; weekly?: WeeklyRow[]; daily?: DailyRow[] };

export type Backend = {
  getAll(): Promise<BackendData>;
  saveConfig(cfg: Config): Promise<Config>;
  saveWeekly(rows: WeeklyRow[]): Promise<unknown>;
  deleteWeek(year: number, week: number): Promise<unknown>;
  saveDaily(rows: DailyRow[]): Promise<unknown>;
};

export type LoadedData = { config: Config; weekly: WeeklyRow[]; daily: DailyMap };

export type Store = {
  state: StoreState;
  load(): Promise<LoadedData>;
  refresh(): Promise<LoadedData>;
  markWeek(row: WeeklyRow): void;
  markDaily(row: DailyRow): void;
  flush(): Promise<void>;
  hasUnsaved(): boolean;
  saveConfig(cfg: Config): Promise<Config>;
  deleteWeek(year: number, week: number): Promise<unknown>;
};

export type StoreOptions = {
  backend?: Backend;
  delay?: number;
  onState?: (state: StoreState, message?: string) => void;
  setTimeoutFn?: (f: () => void, ms: number) => unknown;
  clearTimeoutFn?: (h: unknown) => void;
};

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function memoryStorage(): StorageLike {
  const m: Record<string, string> = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
  };
}

function defaultStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const t = '__cat_probe__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    }
  } catch { /* fall through */ }
  return memoryStorage();
}

/** Default backend over localStorage (inject a fake storageLike in tests). Upsert semantics DR-01; delete keeps daily (DR-04); seeds sample data once (DR-05/FR-27). */
export function localBackend(storageLike?: StorageLike | null, key?: string): Backend {
  const k = key || 'cat_db';
  let st: StorageLike | null = storageLike || null; // resolved lazily (no window access at import/creation time)
  let mem: Any = null; // used if the storage throws on write

  function storage(): StorageLike {
    if (!st) st = defaultStorage();
    return st;
  }
  function read() {
    let d: Any = null;
    try { d = JSON.parse(storage().getItem(k) as string); } catch { d = null; }
    if (!d && mem) d = mem;
    d = d || {};
    return {
      config: Object.assign({}, DEFAULT_CFG, d.config || {}) as Config,
      weekly: (Array.isArray(d.weekly) ? d.weekly : []) as WeeklyRow[],
      daily: (Array.isArray(d.daily) ? d.daily : []) as DailyRow[],
      seeded: !!d.seeded,
    };
  }
  function write(d: Any) {
    mem = d;
    try { storage().setItem(k, JSON.stringify(d)); } catch { /* kept in memory */ }
  }
  function wrap<T>(fn: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      try { resolve(clone(fn())); } catch (e) { reject(e); }
    });
  }
  const sortW = (a: WeeklyRow, b: WeeklyRow) => Number(a.year) - Number(b.year) || Number(a.week) - Number(b.week);
  const sortD = (a: DailyRow, b: DailyRow) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));

  return {
    getAll() {
      return wrap(() => {
        const d = read();
        if (!d.weekly.length && !d.daily.length && !d.seeded) { // DR-05 / FR-27: seed once
          const s = sampleData(d.config);
          d.weekly = s.weekly; d.daily = s.daily; d.seeded = true;
          write(d);
        }
        return { config: d.config, weekly: d.weekly, daily: d.daily };
      });
    },
    saveConfig(cfg) {
      return wrap(() => {
        const d = read(); d.config = Object.assign({}, DEFAULT_CFG, cfg); write(d); return d.config;
      });
    },
    saveWeekly(rows) {
      return wrap(() => {
        const d = read();
        rows.forEach((r) => {
          const i = d.weekly.findIndex((x) => Number(x.year) === Number(r.year) && Number(x.week) === Number(r.week));
          if (i < 0) d.weekly.push(clone(r)); else d.weekly[i] = clone(r);
        });
        d.weekly.sort(sortW); d.seeded = true; write(d); return true;
      });
    },
    deleteWeek(year, week) {
      return wrap(() => {
        const d = read();
        d.weekly = d.weekly.filter((x) => !(Number(x.year) === Number(year) && Number(x.week) === Number(week)));
        d.seeded = true; write(d); return true; // daily rows stay (DR-04)
      });
    },
    saveDaily(rows) {
      return wrap(() => {
        const d = read();
        rows.forEach((r) => {
          const i = d.daily.findIndex((x) => x.date === r.date);
          if (i < 0) d.daily.push(clone(r)); else d.daily[i] = clone(r);
        });
        d.daily.sort(sortD); d.seeded = true; write(d); return true;
      });
    },
  };
}

export function createStore(opts?: StoreOptions): Store {
  const o = opts || {};
  const backend = o.backend || localBackend();
  const delay = o.delay == null ? 1100 : o.delay;
  const onState = o.onState || (() => {});
  const setT = o.setTimeoutFn || ((f: () => void, ms: number) => setTimeout(f, ms));
  const clearT = o.clearTimeoutFn || ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  const qW = new Map<string, WeeklyRow>(), qD = new Map<string, DailyRow>();
  let timer: unknown = null, saving = false;

  const store = { state: 'loading' } as Store;

  function setState(s: StoreState, msg?: string) { store.state = s; try { onState(s, msg); } catch { /* ignore UI errors */ } }
  function wkKey(r: { year: unknown; week: unknown }) { return Number(r.year) + '-' + Number(r.week); }
  function queued() { return qW.size > 0 || qD.size > 0; }
  function schedule() {
    if (timer != null) clearT(timer);
    timer = setT(() => { timer = null; store.flush(); }, delay);
  }

  store.load = function () {
    setState('loading');
    return Promise.resolve().then(() => backend.getAll()).then((d0) => {
      const d: Any = d0 || {};
      const weekly = ((d.weekly || []) as Any[]).map((r) => {
        const row: Any = {};
        WEEKLY_KEYS.forEach((k) => { row[k] = r[k] === undefined || r[k] === null ? '' : r[k]; });
        row.year = Number(row.year); row.week = Number(row.week);
        return row as WeeklyRow;
      });
      const daily: DailyMap = {};
      ((d.daily || []) as DailyRow[]).forEach((r) => {
        daily[r.date] = { date: r.date, maersk: r.maersk, hapag: r.hapag, hellman: r.hellman, one: r.one, fml: r.fml, fcstCbm: r.fcstCbm, actCbm: r.actCbm };
      });
      qW.clear(); qD.clear();
      setState(queued() ? 'dirty' : 'saved');
      return { config: Object.assign({}, DEFAULT_CFG, d.config || {}) as Config, weekly, daily };
    }, (e) => { setState('error', e && e.message); throw e; });
  };
  store.refresh = store.load;

  store.markWeek = function (row) { qW.set(wkKey(row), row); setState('dirty'); schedule(); };
  store.markDaily = function (row) { qD.set(row.date, row); setState('dirty'); schedule(); };

  store.flush = function () {
    if (timer != null) { clearT(timer); timer = null; }
    if (saving) { schedule(); return Promise.resolve(); }
    if (!queued()) return Promise.resolve();
    const wk = Array.from(qW.entries()), dk = Array.from(qD.entries());
    qW.clear(); qD.clear();
    saving = true; setState('saving');
    const weekly = wk.map((e) => clone(e[1]));
    const daily = dk.map((e) => clone(e[1]));
    let p: Promise<unknown> = Promise.resolve();
    if (weekly.length) p = p.then(() => backend.saveWeekly(weekly));
    if (daily.length) p = p.then(() => backend.saveDaily(daily));
    return p.then(() => {
      saving = false;
      setState(queued() ? 'dirty' : 'saved');
    }, (e) => {
      saving = false;
      wk.forEach((x) => { if (!qW.has(x[0])) qW.set(x[0], x[1]); });
      dk.forEach((x) => { if (!qD.has(x[0])) qD.set(x[0], x[1]); });
      setState('error', e && e.message);
    });
  };

  store.hasUnsaved = function () { return queued() || saving; };

  store.saveConfig = function (cfg) {
    if (!(num(cfg && cfg.cbmPerTeu) > 0)) return Promise.reject(new Error('CBM per TEU must be above 0'));
    return Promise.resolve(backend.saveConfig(cfg));
  };
  store.deleteWeek = function (year, week) {
    qW.delete(Number(year) + '-' + Number(week));
    return Promise.resolve(backend.deleteWeek(year, week));
  };

  return store;
}
