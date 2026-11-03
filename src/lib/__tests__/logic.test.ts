import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CAT from '../logic';
import { createStore, localBackend, type Backend, type StorageLike } from '../store';

/* eslint-disable @typescript-eslint/no-explicit-any */

const near = (a: number | null, b: number, eps = 0.001) => expect(Math.abs((a as number) - b)).toBeLessThan(eps);
const cfg: CAT.Config = { ...CAT.DEFAULT_CFG };

function fixtures() {
  const s = CAT.sampleData(cfg);
  const daily: CAT.DailyMap = {};
  s.daily.forEach((r) => { daily[r.date] = r; });
  return { weeks: s.weekly, daily };
}
function fakeStorage(failWrites?: { on: boolean }): StorageLike & { m: Record<string, string> } {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { if (failWrites && failWrites.on) throw new Error('quota'); m[k] = String(v); },
  };
}
const noopBackend = (over: Partial<Backend>): Backend => ({
  getAll: async () => ({}),
  saveWeekly: async () => true,
  saveDaily: async () => true,
  saveConfig: async (c) => c,
  deleteWeek: async () => true,
  ...over,
});

/* ---------------- logic ---------------- */
describe('logic', () => {
  it('constants', () => {
    expect(CAT.CARRIERS.length).toBe(5);
    expect(CAT.ALLOC.map((c) => c.id)).toEqual(['maersk', 'hapag', 'hellman', 'one']);
    expect(CAT.WEEKLY_KEYS.length).toBe(14);
    expect(CAT.WEEKLY_KEYS.slice(0, 6)).toEqual(['year', 'week', 'forecast', 'fml_fcst', 'maersk_conf', 'maersk_util']);
  });

  it('num', () => {
    expect(CAT.num('')).toBe(0); expect(CAT.num(null)).toBe(0);
    expect(CAT.num(NaN)).toBe(0); expect(CAT.num('abc')).toBe(0);
    expect(CAT.num('12.5')).toBe(12.5);
  });

  it('iso week / weekDates / fmt', () => {
    expect(CAT.isoWeekOf('2026-11-03')).toEqual({ year: 2026, week: 45 });
    const d = CAT.weekDates(2026, 43);
    expect(d.length).toBe(7); expect(d[0]).toBe('2026-10-19'); expect(d[6]).toBe('2026-10-25');
    expect(CAT.isoWeekOf('2026-12-31')).toEqual({ year: 2026, week: 53 });
    expect(CAT.isoWeekOf('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(CAT.dowName('2026-10-19')).toBe('Mon');
    expect(CAT.fmtDate('2026-10-19')).toBe('19-Oct-26');
  });

  it('newWeek / allocate / status', () => {
    const w = CAT.newWeek(2026, 5, cfg);
    expect(w.forecast).toBe(''); expect(w.fml_fcst).toBe(10); expect(w.hapag_util).toBe('');
    expect(CAT.allocate(100, cfg)).toEqual({ maersk: 30, hapag: 25, hellman: 20, one: 25 });
    expect(CAT.allocate(79, cfg)).toEqual({ maersk: 24, hapag: 20, hellman: 16, one: 20 });
    expect(CAT.status(-0.6)).toBe('deficit'); expect(CAT.status(0.6)).toBe('surplus');
    expect(CAT.status(0.5)).toBe('balanced'); expect(CAT.status(-0.5)).toBe('balanced');
  });

  it('week 43 fixture', () => {
    const { weeks, daily } = fixtures();
    const c = CAT.calcWeek(weeks[0], cfg, daily);
    expect(c.fc).toEqual({ maersk: 30, hapag: 25, hellman: 20, one: 25, fml: 10 });
    expect(c.conf).toEqual({ maersk: 30, hapag: 20, hellman: 12, one: 25, fml: 15 });
    expect(c.dsum).toEqual({ maersk: 26, hapag: 20, hellman: 12, one: 20, fml: 10 });
    expect(c.totalUtil).toBe(88); expect(c.totalConf).toBe(102); expect(c.leftTotal).toBe(14);
    expect(c.fcstCbm).toBe(3575); expect(c.actCbm).toBe(2235);
    near(c.basis, 108.333); near(c.actTeu, 67.727); near(c.toBeArrived, 40.606); near(c.deficit, -26.606);
    expect(CAT.status(c.deficit)).toBe('deficit');
    near(c.pct.maersk, 26 / 30); near(c.pct.fml, 10 / 15);
    expect(c.fromDaily.maersk).toBe(true);
    expect(c.cbmPlan).toBe(3300);
    near(c.utilPct, 88 / 102); near(c.vsForecast, 0.88);
  });

  it('week 44 fixture', () => {
    const { weeks, daily } = fixtures();
    const c = CAT.calcWeek(weeks[1], cfg, daily);
    expect([c.fc.maersk, c.fc.hapag, c.fc.hellman, c.fc.one]).toEqual([24, 20, 16, 20]);
    expect(c.totalUtil).toBe(0); expect(c.toBeArrived).toBe(79);
    expect(c.leftTotal).toBe(55); expect(c.deficit).toBe(-24);
    expect(c.pct.one).toBe(null); expect(c.share.maersk).toBe(null);
  });

  it('week 45 fixture', () => {
    const { weeks, daily } = fixtures();
    const c = CAT.calcWeek(weeks[2], cfg, daily);
    expect(c.toBeArrived).toBe(54); expect(c.deficit).toBe(-54); expect(c.utilPct).toBe(null);
  });

  it('typed weekly util used when no daily; cbm<=0 falls back to 33', () => {
    const w = { ...CAT.newWeek(2026, 10, cfg), forecast: 10, maersk_conf: 5, maersk_util: 3 };
    const c = CAT.calcWeek(w, { ...cfg, cbmPerTeu: 0 }, {});
    expect(c.util.maersk).toBe(3); expect(c.fromDaily.maersk).toBe(false);
    expect(c.cbmPlan).toBe(330);
  });

  it('dayStats', () => {
    const { daily } = fixtures();
    const s = CAT.dayStats(daily['2026-10-19'], cfg);
    near(s.vs, 415 / 240 - 1); expect(s.hasAct).toBe(true); expect(s.dayTotal).toBe(10);
    near(s.fcstTeu, 240 / 33); near(s.actTeu, 415 / 33);
    const t = CAT.dayStats(daily['2026-10-24'], cfg);
    expect(t.vs).toBe(null); expect(t.hasAct).toBe(false); expect(t.dayTotal).toBe(16);
    expect(CAT.dayStats(undefined, cfg).vs).toBe(null);
  });

  it('yearSummary totals', () => {
    const { weeks, daily } = fixtures();
    const y = CAT.yearSummary(weeks, cfg, daily);
    expect(y.rows.length).toBe(3);
    expect(y.total.f).toBe(233); expect(y.total.c).toBe(102 + 55);
    expect(y.total.u).toBe(88);
    near(y.total.d, -26.606 - 24 - 54); near(y.total.a, 40.606 + 79 + 54);
  });

  it('sampleData shape', () => {
    const s = CAT.sampleData(cfg);
    expect(s.weekly.length).toBe(3); expect(s.daily.length).toBe(7);
    expect(s.weekly.map((w) => w.week)).toEqual([43, 44, 45]);
  });

  it('exportRange 43-44', () => {
    const { weeks, daily } = fixtures();
    const e = CAT.exportRange(weeks.slice(0, 2), cfg, daily);
    expect(e.wr.length).toBe(2); expect(e.dr.length).toBe(14);
    expect(e.wh.slice(0, 4)).toEqual(['Year', 'Week', 'Start', 'End']);
    expect(e.wh.length).toBe(6 + 25 + 10); expect(e.wr[0].length).toBe(e.wh.length);
    expect(e.dh.length).toBe(14); expect(e.dr[0].length).toBe(14);
    expect(e.rows.length).toBe(1 + 1 + 2 + 1 + 1 + 1 + 14);
    const r = e.wr[0];
    expect(r[2]).toBe('2026-10-19'); expect(r[3]).toBe('2026-10-25');
    expect(r[4]).toBe(100); expect(r[5]).toBe(3300);
    expect(r[10]).toBe('87%'); // maersk 26/30
    expect(r[e.wh.length - 1]).toBe(-27); // rounded deficit
    expect(r[e.wh.length - 4]).toBe(67.7); // actual TEUs r1
    const csv = CAT.toCsv(e.rows);
    expect(csv.startsWith('﻿WEEKLY SUMMARY')).toBe(true);
    expect(csv.includes('\r\n\r\nDATE-WISE DETAIL\r\n')).toBe(true);
    expect(e.dr[0][11]).toBe(415); expect(e.dr[0][13]).toBe('73%');
    expect(e.dr[5][11]).toBe(''); expect(e.dr[5][13]).toBe('');
    expect(CAT.exportRange([], cfg, daily).dr.length).toBe(0);
  });

  it('weeklyRows / dailyRows cover all, sorted', () => {
    const { weeks, daily } = fixtures();
    const extra = CAT.newWeek(2025, 52, cfg);
    const rows = CAT.weeklyRows([weeks[2], weeks[0], extra, weeks[1]], cfg, daily);
    expect(rows.length).toBe(5);
    expect(rows[0].slice(0, 4)).toEqual(['Year', 'Week', 'From', 'To']);
    expect(rows.slice(1).map((r) => r[0] + '-' + r[1])).toEqual(['2025-52', '2026-43', '2026-44', '2026-45']);
    const hdr = rows[0];
    expect(hdr.slice(-8)).toEqual(['Total Confirmed', 'Total Utilized', 'Utilization %', 'To Be Arrived', 'To Be Utilized', 'Deficit/Surplus', 'Actual CBM', 'Forecast CBM (daily)']);
    const w43 = rows[2];
    expect(w43[w43.length - 6]).toBe('86%'); // 88/102
    expect(w43[w43.length - 5]).toBe(40.6); expect(w43[w43.length - 3]).toBe(-26.6);
    const d = CAT.dailyRows({ ...daily, '2026-01-01': { date: '2026-01-01', maersk: 1, hapag: '', hellman: '', one: '', fml: '', fcstCbm: '', actCbm: '' } }, cfg);
    expect(d.length).toBe(9);
    expect(d[1][0]).toBe('2026-01-01'); expect(d[1].slice(2, 4)).toEqual([2026, 1]);
    expect(d[2][0]).toBe('2026-10-19'); expect(d[2][1]).toBe('Mon');
    expect(d[0].slice(0, 4)).toEqual(['Date', 'Day', 'ISO Year', 'Week']);
    expect(d[2][9]).toBe(10); expect(d[2][10]).toBe(240); expect(d[2][11]).toBe(7.3);
    expect(d[7][12]).toBe(''); // blank actual stays blank
  });

  it('toCsv quoting, BOM, CRLF; toTsv', () => {
    const rows = [['a', 'b,c', 'd"e', 'f\ng'], [1, null, '', 'x']];
    const csv = CAT.toCsv(rows);
    expect(csv).toBe('﻿a,"b,c","d""e","f\ng"\r\n1,,,x');
    expect(CAT.toTsv(rows)).toBe('a\tb,c\td"e\tf\ng\n1\t\t\tx');
  });
});

/* ---------------- store ---------------- */
function mkStore(extra?: Partial<Parameters<typeof createStore>[0]>) {
  const storage = fakeStorage();
  const backend = localBackend(storage);
  const states: string[] = [];
  const store = createStore({ backend, delay: 15, onState: (s, m) => states.push(s + (m ? ':' + m : '')), ...extra });
  return { storage, backend, store, states };
}

describe('store', () => {
  it('localBackend seeds once and sorts; delete keeps daily', async () => {
    const storage = fakeStorage();
    const b = localBackend(storage);
    const a1 = await b.getAll();
    expect(a1.weekly!.length).toBe(3); expect(a1.daily!.length).toBe(7);
    for (const w of a1.weekly!) await b.deleteWeek(w.year, w.week);
    const a2 = await b.getAll();
    expect(a2.weekly!.length).toBe(0); expect(a2.daily!.length, 'daily rows stay (DR-04)').toBe(7);
    // wipe daily too via a fresh backend on emptied storage with the seeded flag kept
    const raw = JSON.parse(storage.getItem('cat_db') as string); raw.daily = []; storage.setItem('cat_db', JSON.stringify(raw));
    const a3 = await b.getAll();
    expect(a3.weekly!.length).toBe(0); expect(a3.daily!.length, 'no re-seed').toBe(0);
  });

  it('localBackend upsert + sort order', async () => {
    const b = localBackend(fakeStorage());
    await b.getAll();
    const mk = (y: number, w: number, f: number) => ({ ...CAT.newWeek(y, w, cfg), forecast: f });
    await b.saveWeekly([mk(2027, 1, 5), mk(2026, 50, 6), mk(2026, 44, 999)]);
    const all = await b.getAll();
    expect(all.weekly!.map((w) => w.year + '-' + w.week)).toEqual(['2026-43', '2026-44', '2026-45', '2026-50', '2027-1']);
    expect(all.weekly!.find((w) => w.week === 44)!.forecast).toBe(999);
    expect(all.weekly!.length).toBe(5);
    await b.saveDaily([{ date: '2026-10-19', maersk: 99 }, { date: '2025-01-01', maersk: 1 }]);
    const a2 = await b.getAll();
    expect(a2.daily!.length).toBe(8); expect(a2.daily![0].date).toBe('2025-01-01');
    expect(a2.daily!.find((d) => d.date === '2026-10-19')!.maersk).toBe(99);
  });

  it('store.load normalises rows, maps daily, merges config', async () => {
    const storage = fakeStorage();
    storage.setItem('cat_db', JSON.stringify({ config: { cbmPerTeu: 40 }, seeded: true, weekly: [{ year: '2026', week: '7', forecast: 5 }], daily: [{ date: '2026-02-09', maersk: 3 }] }));
    const store = createStore({ backend: localBackend(storage), delay: 5 });
    const d = await store.load();
    expect(d.config.cbmPerTeu).toBe(40); expect(d.config.pct_maersk).toBe(30);
    expect(d.weekly[0].year).toBe(2026); expect(d.weekly[0].week).toBe(7);
    expect(d.weekly[0].hapag_conf).toBe(''); expect(Object.keys(d.weekly[0]).length).toBe(CAT.WEEKLY_KEYS.length);
    expect(d.daily['2026-02-09'].maersk).toBe(3); expect(d.daily['2026-02-09'].hapag).toBe(undefined);
    expect(store.state).toBe('saved');
  });

  it('store seeds on first load only', async () => {
    const { storage, store } = mkStore();
    const d1 = await store.load();
    expect(d1.weekly.length).toBe(3); expect(Object.keys(d1.daily).length).toBe(7);
    const store2 = createStore({ backend: localBackend(storage), delay: 5 });
    const d2 = await store2.load();
    expect(d2.weekly.length).toBe(3);
  });

  describe('timers (fake)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    const sleep = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    it('debounce coalescing', async () => {
      const calls: any[] = [];
      const backend = noopBackend({
        getAll: async () => ({ weekly: [], daily: [] }),
        saveWeekly: async (rows) => { calls.push(['w', rows.map((r) => r.forecast)]); },
        saveDaily: async (rows) => { calls.push(['d', rows.length]); },
      });
      const states: string[] = [];
      const store = createStore({ backend, delay: 30, onState: (s) => states.push(s) });
      await store.load();
      const w = CAT.newWeek(2026, 1, cfg);
      w.forecast = 1; store.markWeek(w);
      await sleep(10); w.forecast = 2; store.markWeek(w);
      await sleep(10); w.forecast = 3; store.markWeek(w);
      store.markDaily({ date: '2026-01-01', maersk: 1 });
      expect(store.state).toBe('dirty'); expect(store.hasUnsaved()).toBe(true);
      await sleep(15);
      expect(calls.length, 'not flushed before the delay elapsed since last edit').toBe(0);
      await sleep(60);
      expect(calls).toEqual([['w', [3]], ['d', 1]]);
      expect(store.state).toBe('saved'); expect(store.hasUnsaved()).toBe(false);
      expect(states.includes('saving')).toBe(true);
    });

    it('failure keeps queue + error state, recovers on next edit', async () => {
      let fail = true; const saved: number[][] = [];
      const backend = noopBackend({
        saveWeekly: async (rows) => { if (fail) throw new Error('boom'); saved.push(rows.map((r) => r.week)); },
      });
      const states: [string, string | undefined][] = [];
      const store = createStore({ backend, delay: 10, onState: (s, m) => states.push([s, m]) });
      store.markWeek(CAT.newWeek(2026, 1, cfg));
      await sleep(50);
      expect(store.state).toBe('error');
      expect(states[states.length - 1]).toEqual(['error', 'boom']);
      expect(store.hasUnsaved(), 'row stays queued').toBe(true);
      fail = false;
      store.markWeek(CAT.newWeek(2026, 2, cfg));
      await sleep(50);
      expect(store.state).toBe('saved');
      expect(saved).toEqual([[1, 2]]);
      expect(store.hasUnsaved()).toBe(false);
    });

    it('flush never overlaps and edits during saving are saved after', async () => {
      let release: () => void = () => {}, inFlight = 0, maxInFlight = 0; const batches: unknown[][] = [];
      const backend = noopBackend({
        saveWeekly: (rows) => new Promise<void>((res) => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); batches.push(rows.map((r) => r.forecast)); release = () => { inFlight--; res(); }; }),
      });
      const store = createStore({ backend, delay: 80 });
      const w = CAT.newWeek(2026, 1, cfg); w.forecast = 1;
      store.markWeek(w);
      await sleep(110);
      expect(store.state).toBe('saving');
      w.forecast = 2; store.markWeek(w);
      await sleep(110); // timer fires while saving -> rescheduled, not overlapping
      expect(batches.length).toBe(1);
      release();
      await sleep(10);
      expect(store.state).toBe('dirty');
      await sleep(150);
      expect(batches.length).toBe(2); release(); await sleep(10);
      expect(batches).toEqual([[1], [2]]); expect(maxInFlight).toBe(1);
      expect(store.state).toBe('saved');
    });
  });

  it('injectable timer function', async () => {
    const pending: [() => void, number][] = [];
    const saved: number[] = [];
    const backend = noopBackend({ saveWeekly: async (r) => { saved.push(r.length); } });
    const store = createStore({
      backend, delay: 1100,
      setTimeoutFn: (f, ms) => { pending.push([f, ms]); return pending.length; },
      clearTimeoutFn: () => {},
    });
    store.markWeek(CAT.newWeek(2026, 1, cfg));
    expect(pending[0][1]).toBe(1100);
    pending[pending.length - 1][0]();
    await new Promise((r) => setTimeout(r, 5));
    expect(saved).toEqual([1]);
  });

  it('saveConfig rejects cbmPerTeu <= 0, accepts valid', async () => {
    const { store, storage } = mkStore();
    await expect(store.saveConfig({ ...cfg, cbmPerTeu: 0 })).rejects.toThrow(/CBM per TEU/);
    await expect(store.saveConfig({ ...cfg, cbmPerTeu: -3 })).rejects.toThrow();
    await expect(store.saveConfig({ ...cfg, cbmPerTeu: '' as unknown as number })).rejects.toThrow();
    expect(storage.getItem('cat_db')).toBe(null);
    const saved = await store.saveConfig({ ...cfg, cbmPerTeu: 40 });
    expect(saved.cbmPerTeu).toBe(40);
    expect(JSON.parse(storage.getItem('cat_db') as string).config.cbmPerTeu).toBe(40);
  });

  it('store.deleteWeek removes weekly only and drops queued row; refresh reloads', async () => {
    const { store } = mkStore({ delay: 500 });
    const d = await store.load();
    const w = d.weekly[0];
    store.markWeek(w);
    await store.deleteWeek(w.year, w.week);
    expect(store.hasUnsaved(), 'queued row for deleted week dropped').toBe(false);
    const d2 = await store.refresh();
    expect(d2.weekly.length).toBe(2); expect(Object.keys(d2.daily).length).toBe(7);
  });

  it('localBackend falls back to memory when storage write throws', async () => {
    const flag = { on: true };
    const b = localBackend(fakeStorage(flag));
    await b.saveWeekly([CAT.newWeek(2026, 3, cfg)]);
    const all = await b.getAll();
    expect(all.weekly!.some((w) => w.week === 3)).toBe(true);
  });
});
