/* Management reports (pure, no DOM). Currently: Allocation vs. Utilization (monthly extract).
 * Format = business_requirement_document/allocation vs. utilization format.xlsx.
 *
 * DEFINITIONS (derived from the boss's sample numbers; change them here only):
 * - Month of an ISO week = the calendar month of the week's THURSDAY (ISO convention),
 *   see monthOfWeek(). Week 43/2026 -> October, week 45/2026 (Thu 5 Nov) -> November.
 * - UTILIZATION (TEU)      = sum over the month's weeks of calcWeek().util[carrier]
 *                            (BR-03: daily sum when > 0, else the weekly typed value).
 * - LOGIC FORECAST (TEU)   = sum over the month's weeks of calcWeek().fc[carrier]
 *                            (weekly forecast x configured %, rounded per week; FML = its own forecast).
 * - UTILIZATION (%)        = carrier util / total util of the month (share of used); null when total is 0.
 * - ALLOCATION (%)         = configured pct_* / 100 for the four allocated carriers; FML-ONE = N/A (null).
 * - TOTAL                  = sums; UTILIZATION % = 100% (when total util > 0); ALLOCATION % = sum of the
 *                            four configured % / 100.
 * - The FML carrier is labelled 'FML-ONE' in this report (as in the template).
 */
import {
  CARRIERS, calcWeek, num, weekDates,
  type CarrierId, type Config, type CsvCell, type DailyMap, type WeeklyRow,
} from './logic';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type MonthRef = { year: number; month: number };
export type MonthOption = { year: number; month: number; label: string; key: string; weekNumbers: number[] };

export type AllocUtilRow = {
  id: CarrierId;
  label: string;
  utilTeu: number;
  logicForecastTeu: number;
  utilPct: number | null;
  /** null => rendered as 'N/A' */
  allocPct: number | null;
};

export type AllocUtilReport = {
  title: 'Summary:';
  monthLabel: string; // e.g. 'OCTOBER'
  year: number;
  month: number;
  rows: AllocUtilRow[];
  total: { utilTeu: number; logicForecastTeu: number; utilPct: number | null; allocPct: number };
  weekNumbers: number[];
};

export const REPORT_HEADERS = ['UTILIZATION (TEU)', 'LOGIC FORECAST (TEU)', 'UTILIZATION (%)', 'ALLOCATION (%)'] as const;

/** Month a week belongs to: the calendar month of its Thursday (ISO convention). */
export function monthOfWeek(year: number, week: number): MonthRef {
  const thu = weekDates(year, week)[3]; // yyyy-mm-dd
  const p = thu.split('-').map(Number);
  return { year: p[0], month: p[1] };
}

export const monthKey = (year: number, month: number) => year + '-' + String(month).padStart(2, '0');
export const monthTitle = (year: number, month: number) => MONTH_NAMES[month - 1] + ' ' + year;

function weeksOfMonth(weeks: WeeklyRow[], year: number, month: number): WeeklyRow[] {
  return weeks
    .filter((w) => { const m = monthOfWeek(w.year, w.week); return m.year === year && m.month === month; })
    .sort((a, b) => a.year - b.year || a.week - b.week);
}

/** Months that contain at least one week of data, sorted ascending. */
export function monthsAvailable(weeks: WeeklyRow[]): MonthOption[] {
  const map = new Map<string, MonthOption>();
  weeks.forEach((w) => {
    const m = monthOfWeek(w.year, w.week);
    const key = monthKey(m.year, m.month);
    const cur = map.get(key) || { year: m.year, month: m.month, label: monthTitle(m.year, m.month), key, weekNumbers: [] };
    if (!cur.weekNumbers.includes(w.week)) cur.weekNumbers.push(w.week);
    map.set(key, cur);
  });
  const out = Array.from(map.values());
  out.forEach((o) => o.weekNumbers.sort((a, b) => a - b));
  return out.sort((a, b) => a.year - b.year || a.month - b.month);
}

/** 'weeks 43-44' / 'week 45' / 'weeks 1, 3' (non-contiguous). */
export function weeksLabel(nums: number[]): string {
  if (!nums.length) return 'no weeks';
  if (nums.length === 1) return 'week ' + nums[0];
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  return 'weeks ' + (contiguous ? nums[0] + '-' + nums[nums.length - 1] : nums.join(', '));
}

const clean = (n: number) => Math.round(n * 100) / 100;

export function allocationVsUtilization(
  weeks: WeeklyRow[], cfg: Config, daily: DailyMap | null | undefined, year: number, month: number,
): AllocUtilReport {
  const inMonth = weeksOfMonth(weeks, year, month);
  const util = {} as Record<CarrierId, number>;
  const fc = {} as Record<CarrierId, number>;
  CARRIERS.forEach((c) => { util[c.id] = 0; fc[c.id] = 0; });
  inMonth.forEach((w) => {
    const c = calcWeek(w, cfg, daily);
    CARRIERS.forEach((k) => { util[k.id] += c.util[k.id]; fc[k.id] += c.fc[k.id]; });
  });
  const totalUtil = CARRIERS.reduce((a, c) => a + util[c.id], 0);
  const totalFc = CARRIERS.reduce((a, c) => a + fc[c.id], 0);
  const pctOf = (id: CarrierId): number | null =>
    id === 'fml' ? null : num((cfg as unknown as Record<string, unknown>)['pct_' + id]) / 100;
  const rows: AllocUtilRow[] = CARRIERS.map((c) => ({
    id: c.id,
    label: c.id === 'fml' ? 'FML-ONE' : c.name,
    utilTeu: clean(util[c.id]),
    logicForecastTeu: clean(fc[c.id]),
    utilPct: totalUtil > 0 ? util[c.id] / totalUtil : null,
    allocPct: pctOf(c.id),
  }));
  const allocSum = rows.reduce((a, r) => a + (r.allocPct ?? 0), 0);
  return {
    title: 'Summary:',
    monthLabel: MONTH_NAMES[month - 1].toUpperCase(),
    year,
    month,
    rows,
    total: {
      utilTeu: clean(totalUtil),
      logicForecastTeu: clean(totalFc),
      utilPct: totalUtil > 0 ? 1 : null,
      allocPct: Math.round(allocSum * 10000) / 10000,
    },
    weekNumbers: inMonth.map((w) => w.week),
  };
}

export const pctText = (v: number | null): string => (v == null ? '' : Math.round(v * 100) + '%');

/** Array-of-arrays matching the template sheet layout (percent cells as '40%' strings). */
export function allocationVsUtilizationRows(r: AllocUtilReport): CsvCell[][] {
  return [
    [r.title],
    [r.monthLabel, ...REPORT_HEADERS],
    ...r.rows.map((x): CsvCell[] => [x.label, x.utilTeu, x.logicForecastTeu, pctText(x.utilPct), x.allocPct == null ? 'N/A' : pctText(x.allocPct)]),
    ['TOTAL', r.total.utilTeu, r.total.logicForecastTeu, pctText(r.total.utilPct), pctText(r.total.allocPct)],
  ];
}

export function allocationVsUtilizationFileName(r: AllocUtilReport, ext: 'xlsx' | 'csv'): string {
  return `allocation-vs-utilization_${r.monthLabel}-${r.year}.${ext}`;
}
