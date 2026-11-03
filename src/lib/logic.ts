/* Carrier Allocation & Utilization Tracker - pure business logic (no DOM, no framework).
 * Ported 1:1 from js/tracker/logic.js (see SPEC_TRACKER.md).
 * `daily` is a map { 'yyyy-mm-dd': DailyRow }; dates are 'yyyy-mm-dd' strings.
 * Input cells may be '' (blank) or numbers; num() maps blank/NaN to 0.
 */

export type CarrierId = 'maersk' | 'hapag' | 'hellman' | 'one' | 'fml';
export type AllocId = Exclude<CarrierId, 'fml'>;
export type Carrier = { id: CarrierId; name: string; color: string };
/** A user-entered cell: number, or '' when blank. */
export type Cell = number | string;

export type Config = {
  cbmPerTeu: number;
  fmlDefault: number;
  pct_maersk: number;
  pct_hapag: number;
  pct_hellman: number;
  pct_one: number;
};

export type WeeklyRow = {
  year: number;
  week: number;
  forecast: Cell;
  fml_fcst: Cell;
  maersk_conf: Cell; maersk_util: Cell;
  hapag_conf: Cell; hapag_util: Cell;
  hellman_conf: Cell; hellman_util: Cell;
  one_conf: Cell; one_util: Cell;
  fml_conf: Cell; fml_util: Cell;
};

export type DailyRow = {
  date: string;
  maersk?: Cell; hapag?: Cell; hellman?: Cell; one?: Cell; fml?: Cell;
  fcstCbm?: Cell;
  actCbm?: Cell;
};
export type DailyMap = Record<string, DailyRow>;

export type PerCarrier<T> = Record<CarrierId, T>;

export type WeekCalc = {
  dates: string[];
  fc: PerCarrier<number>;
  conf: PerCarrier<number>;
  util: PerCarrier<number>;
  left: PerCarrier<number>;
  dsum: PerCarrier<number>;
  fromDaily: PerCarrier<boolean>;
  pct: PerCarrier<number | null>;
  share: PerCarrier<number | null>;
  totalConf: number;
  totalUtil: number;
  leftTotal: number;
  fcstCbm: number;
  actCbm: number;
  basis: number;
  actTeu: number;
  toBeArrived: number;
  deficit: number;
  cbmPlan: number;
  utilPct: number | null;
  vsForecast: number | null;
};

export type DayStats = {
  dayTotal: number;
  fcstTeu: number;
  actTeu: number;
  hasAct: boolean;
  vs: number | null;
};

export type YearSummary = {
  rows: { week: WeeklyRow; c: WeekCalc }[];
  total: { f: number; c: number; u: number; a: number; l: number; d: number };
};

export type WeekStatus = 'deficit' | 'surplus' | 'balanced';
export type CsvCell = string | number | null | undefined;
export type ExportResult = {
  ws: WeeklyRow[]; wh: string[]; wr: CsvCell[][]; dh: string[]; dr: CsvCell[][]; rows: CsvCell[][];
};

export const CARRIERS: Carrier[] = [
  { id: 'maersk', name: 'MAERSK', color: '#3f7fa6' },
  { id: 'hapag', name: 'HAPAG', color: '#c9793f' },
  { id: 'hellman', name: 'HELLMAN', color: '#4f8a6a' },
  { id: 'one', name: 'ONE', color: '#a8456f' },
  { id: 'fml', name: 'FML', color: '#7d8590' },
];
/** The four carriers that receive a % of the forecast (FML does not, BR-02). */
export const ALLOC: Carrier[] = CARRIERS.slice(0, 4);
export const DEFAULT_CFG: Config = { cbmPerTeu: 33, fmlDefault: 10, pct_maersk: 30, pct_hapag: 25, pct_hellman: 20, pct_one: 25 };
export const WEEKLY_KEYS: string[] = ['year', 'week', 'forecast', 'fml_fcst'];
CARRIERS.forEach((c) => { WEEKLY_KEYS.push(c.id + '_conf', c.id + '_util'); });
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function num(v: unknown): number { return (v === '' || v == null || isNaN(Number(v))) ? 0 : Number(v); }
export function r1(n: number): number { return Math.round(n * 10) / 10; }
function cfgOf(cfg?: Config | null): Config { return cfg || DEFAULT_CFG; }
export function cbmOf(cfg?: Config | null): number { return num(cfgOf(cfg).cbmPerTeu) || 33; }
function has(v: unknown): boolean { return v !== '' && v != null; }

export function fmtDate(s: string): string { const p = s.split('-'); return p[2] + '-' + MONTHS[Number(p[1]) - 1] + '-' + p[0].slice(2); }
export function dowName(s: string): string {
  const p = s.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
}
export function isoWeekOf(s: string): { year: number; week: number } {
  const p = s.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return { year: dt.getUTCFullYear(), week: Math.ceil(((dt.getTime() - ys.getTime()) / 86400000 + 1) / 7) };
}
export function weekDates(year: number, week: number): string[] {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - (dow - 1) + (week - 1) * 7);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(mon);
    x.setUTCDate(mon.getUTCDate() + i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function newWeek(year: number, week: number, cfg?: Config | null): WeeklyRow {
  const w: Any = { year, week, forecast: '', fml_fcst: cfgOf(cfg).fmlDefault };
  CARRIERS.forEach((c) => { w[c.id + '_conf'] = ''; w[c.id + '_util'] = ''; });
  return w as WeeklyRow;
}

/** BR-01: split the weekly forecast by carrier %, each share rounded to a whole TEU. */
export function allocate(total: number, cfg?: Config | null): Record<AllocId, number> {
  const out: Any = {};
  ALLOC.forEach((c) => { out[c.id] = Math.round(total * num((cfgOf(cfg) as Any)['pct_' + c.id]) / 100); });
  return out;
}

export function calcWeek(w: WeeklyRow, cfg?: Config | null, daily?: DailyMap | null): WeekCalc {
  const dm: DailyMap = daily || {};
  const wa = w as Any;
  const cpt = cbmOf(cfg);
  const dates = weekDates(w.year, w.week);
  const days: Any[] = dates.map((d) => dm[d] || {});
  const sum = (f: (d: Any) => number) => days.reduce((a, d) => a + f(d), 0);
  const fc: Any = allocate(num(w.forecast), cfg);
  fc.fml = num(w.fml_fcst);
  const conf: Any = {}, util: Any = {}, left: Any = {}, dsum: Any = {}, fromDaily: Any = {}, pct: Any = {}, share: Any = {};
  let totalConf = 0, totalUtil = 0;
  CARRIERS.forEach((c) => {
    conf[c.id] = num(wa[c.id + '_conf']);
    dsum[c.id] = sum((d) => num(d[c.id]));
    fromDaily[c.id] = dsum[c.id] > 0;
    util[c.id] = fromDaily[c.id] ? dsum[c.id] : num(wa[c.id + '_util']);
    left[c.id] = conf[c.id] - util[c.id];
    totalConf += conf[c.id];
    totalUtil += util[c.id];
  });
  CARRIERS.forEach((c) => {
    pct[c.id] = conf[c.id] > 0 ? util[c.id] / conf[c.id] : null;
    share[c.id] = totalUtil > 0 ? util[c.id] / totalUtil : null;
  });
  const fcstCbm = sum((d) => num(d.fcstCbm));
  const actCbm = sum((d) => num(d.actCbm));
  const basis = fcstCbm > 0 ? fcstCbm / cpt : num(w.forecast);
  const actTeu = actCbm / cpt;
  const toBeArrived = Math.max(0, basis - actTeu);
  const leftTotal = totalConf - totalUtil;
  return {
    dates, fc, conf, util, left, dsum, fromDaily,
    pct, share, totalConf, totalUtil, leftTotal,
    fcstCbm, actCbm, basis, actTeu, toBeArrived,
    deficit: leftTotal - toBeArrived,
    cbmPlan: num(w.forecast) * cpt,
    utilPct: totalConf > 0 ? totalUtil / totalConf : null,
    vsForecast: num(w.forecast) > 0 ? totalUtil / num(w.forecast) : null,
  };
}

export function yearSummary(weeks: WeeklyRow[], cfg?: Config | null, daily?: DailyMap | null): YearSummary {
  const total = { f: 0, c: 0, u: 0, a: 0, l: 0, d: 0 };
  const rows = weeks.map((w) => {
    const c = calcWeek(w, cfg, daily);
    total.f += num(w.forecast); total.c += c.totalConf; total.u += c.totalUtil;
    total.a += c.toBeArrived; total.l += c.leftTotal; total.d += c.deficit;
    return { week: w, c };
  });
  return { rows, total };
}

/** BR-11 */
export function status(deficit: number): WeekStatus { return deficit < -0.5 ? 'deficit' : (deficit > 0.5 ? 'surplus' : 'balanced'); }

export function dayStats(row?: DailyRow | null, cfg?: Config | null): DayStats {
  const r: Any = row || {};
  const cpt = cbmOf(cfg);
  const dayTotal = CARRIERS.reduce((a, k) => a + num(r[k.id]), 0);
  const hasAct = has(r.actCbm);
  const vs = num(r.fcstCbm) > 0 && hasAct ? num(r.actCbm) / num(r.fcstCbm) - 1 : null;
  return { dayTotal, fcstTeu: num(r.fcstCbm) / cpt, actTeu: num(r.actCbm) / cpt, hasAct, vs };
}

export function sampleData(cfg?: Config | null): { weekly: WeeklyRow[]; daily: DailyRow[] } {
  const mk = (w: number, o: Partial<WeeklyRow>): WeeklyRow => Object.assign(newWeek(2026, w, cfg), o);
  const weekly = [
    mk(43, { forecast: 100, fml_fcst: 10, maersk_conf: 30, hapag_conf: 20, hellman_conf: 12, one_conf: 25, fml_conf: 15 }),
    mk(44, { forecast: 79, fml_fcst: 10, maersk_conf: 25, hapag_conf: 20, hellman_conf: 10 }),
    mk(45, { forecast: 54, fml_fcst: 10 }),
  ];
  const daily: DailyRow[] = [];
  const D = (date: string, m: Cell, h: Cell, hm: Cell, o: Cell, f: Cell, fc: Cell, ac: Cell) => {
    daily.push({ date, maersk: m, hapag: h, hellman: hm, one: o, fml: f, fcstCbm: fc, actCbm: ac });
  };
  D('2026-10-19', 10, '', '', '', '', 240, 415);
  D('2026-10-20', 10, '', 12, '', '', 710, 374);
  D('2026-10-21', '', '', '', '', 10, 241, 694);
  D('2026-10-22', '', '', '', 12, '', 591, 408);
  D('2026-10-23', '', 18, '', '', '', 1318, 344);
  D('2026-10-24', 6, 2, '', 8, '', 40, '');
  D('2026-10-25', '', '', '', '', '', 435, '');
  return { weekly, daily };
}

/** Port of prev exportData; `weeks` is already filtered to the range. */
export function exportRange(weeks: WeeklyRow[], cfg?: Config | null, daily?: DailyMap | null): ExportResult {
  const dm: Any = daily || {};
  const cpt = cbmOf(cfg);
  const wh: string[] = ['Year', 'Week', 'Start', 'End', 'Forecast TEUs (+25%)', 'CBM (+25%)'];
  CARRIERS.forEach((k) => { wh.push(k.name + ' Forecast', k.name + ' Confirmed', k.name + ' Utilized', k.name + ' Left', k.name + ' Util %'); });
  wh.push('Total Confirmed', 'Total Utilized', 'Util % of Confirmed', 'Forecast CBM (daily)', 'Actual CBM', 'Forecast TEUs (daily)', 'Actual TEUs', 'To Be Arrived', 'To Be Utilized', 'Deficit/Surplus');
  const wr: CsvCell[][] = [];
  const dh: string[] = ['Week', 'Date', 'Day'].concat(CARRIERS.map((k) => k.name + ' TEUs'),
    ['Day Total TEUs', 'Forecast CBM', 'Forecast TEUs', 'Actual CBM', 'Actual TEUs', 'Actual vs Forecast %']);
  const dr: CsvCell[][] = [];
  weeks.forEach((w) => {
    const c = calcWeek(w, cfg, dm);
    const r: CsvCell[] = [w.year, w.week, c.dates[0], c.dates[6], num(w.forecast), Math.round(c.cbmPlan)];
    CARRIERS.forEach((k) => {
      r.push(c.fc[k.id], c.conf[k.id], c.util[k.id], c.left[k.id], c.pct[k.id] == null ? '' : Math.round((c.pct[k.id] as number) * 100) + '%');
    });
    r.push(c.totalConf, c.totalUtil, c.utilPct == null ? '' : Math.round(c.utilPct * 100) + '%', c.fcstCbm, c.actCbm,
      r1(c.fcstCbm / cpt), r1(c.actTeu), Math.round(c.toBeArrived), c.leftTotal, Math.round(c.deficit));
    wr.push(r);
    c.dates.forEach((d) => {
      const x = dm[d] || {};
      const tot = CARRIERS.reduce((a, k) => a + num(x[k.id]), 0);
      const hasAct = has(x.actCbm);
      const v = num(x.fcstCbm) > 0 && hasAct ? Math.round((num(x.actCbm) / num(x.fcstCbm) - 1) * 100) + '%' : '';
      dr.push(([w.week, d, dowName(d)] as CsvCell[]).concat(
        CARRIERS.map((k) => (x[k.id] == null ? '' : x[k.id])),
        [tot || '', x.fcstCbm == null ? '' : x.fcstCbm, num(x.fcstCbm) ? r1(num(x.fcstCbm) / cpt) : '',
          hasAct ? x.actCbm : '', hasAct && num(x.actCbm) ? r1(num(x.actCbm) / cpt) : '', v]));
    });
  });
  return { ws: weeks, wh, wr, dh, dr, rows: ([['WEEKLY SUMMARY'], wh] as CsvCell[][]).concat(wr, [[], ['DATE-WISE DETAIL'], dh], dr) };
}

export function weeklyRows(allWeeks: WeeklyRow[], cfg?: Config | null, daily?: DailyMap | null): CsvCell[][] {
  const dm: DailyMap = daily || {};
  const head: string[] = ['Year', 'Week', 'From', 'To', 'Forecast TEUs (+25%)', 'CBM +25%'];
  CARRIERS.forEach((k) => { head.push(k.name + ' Forecast', k.name + ' Confirmed', k.name + ' Utilized'); });
  head.push('Total Confirmed', 'Total Utilized', 'Utilization %', 'To Be Arrived', 'To Be Utilized', 'Deficit/Surplus', 'Actual CBM', 'Forecast CBM (daily)');
  const rows: CsvCell[][] = [head];
  allWeeks.slice().sort((a, b) => a.year - b.year || a.week - b.week).forEach((w) => {
    const c = calcWeek(w, cfg, dm);
    const row: CsvCell[] = [w.year, w.week, c.dates[0], c.dates[6], num(w.forecast), c.cbmPlan];
    CARRIERS.forEach((k) => { row.push(c.fc[k.id], c.conf[k.id], c.util[k.id]); });
    row.push(c.totalConf, c.totalUtil, c.utilPct == null ? '' : Math.round(c.utilPct * 100) + '%',
      r1(c.toBeArrived), r1(c.leftTotal), r1(c.deficit), c.actCbm, c.fcstCbm);
    rows.push(row);
  });
  return rows;
}

export function dailyRows(daily?: DailyMap | null, cfg?: Config | null): CsvCell[][] {
  const dm: Any = daily || {};
  const cpt = cbmOf(cfg);
  const head: string[] = ['Date', 'Day', 'ISO Year', 'Week'].concat(CARRIERS.map((k) => k.name + ' TEUs'),
    ['Day Total TEUs', 'Forecast CBM', 'Forecast TEUs', 'Actual CBM', 'Actual TEUs']);
  const rows: CsvCell[][] = [head];
  Object.keys(dm).sort().forEach((d) => {
    const r = dm[d], iw = isoWeekOf(d);
    rows.push(([d, dowName(d), iw.year, iw.week] as CsvCell[]).concat(
      CARRIERS.map((k) => (has(r[k.id]) ? num(r[k.id]) : '')),
      [CARRIERS.reduce((a, k) => a + num(r[k.id]), 0),
        has(r.fcstCbm) ? num(r.fcstCbm) : '', has(r.fcstCbm) ? r1(num(r.fcstCbm) / cpt) : '',
        has(r.actCbm) ? num(r.actCbm) : '', has(r.actCbm) ? r1(num(r.actCbm) / cpt) : '']));
  });
  return rows;
}

export function csvEsc(v: CsvCell): string { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
/** BOM + CRLF-joined, RFC4180 quoting. */
export function toCsv(rows: CsvCell[][]): string { return '﻿' + rows.map((r) => r.map(csvEsc).join(',')).join('\r\n'); }
export function toTsv(rows: CsvCell[][]): string { return rows.map((r) => r.join('\t')).join('\n'); }
