import { describe, expect, it } from 'vitest';
import * as CAT from '../logic';
import {
  allocationVsUtilization, allocationVsUtilizationFileName, allocationVsUtilizationRows,
  monthOfWeek, monthsAvailable, weeksLabel,
} from '../reports';
import { buildAllocationVsUtilizationXlsx } from '../reportXlsx';

const cfg: CAT.Config = { ...CAT.DEFAULT_CFG };
function data() {
  const s = CAT.sampleData(cfg);
  const daily: CAT.DailyMap = {};
  s.daily.forEach((r) => { daily[r.date] = r; });
  return { weeks: s.weekly, daily };
}
const ids = ['maersk', 'hapag', 'hellman', 'one', 'fml'] as const;

describe('monthOfWeek', () => {
  it('uses the Thursday of the ISO week', () => {
    expect(monthOfWeek(2026, 43)).toEqual({ year: 2026, month: 10 });
    expect(monthOfWeek(2026, 44)).toEqual({ year: 2026, month: 10 });
    expect(monthOfWeek(2026, 45)).toEqual({ year: 2026, month: 11 }); // Thu 5 Nov
  });
  it('handles the year boundary (week 53 of 2026, week 1 of 2027)', () => {
    expect(CAT.weekDates(2026, 53)[3]).toBe('2026-12-31');
    expect(monthOfWeek(2026, 53)).toEqual({ year: 2026, month: 12 });
    expect(CAT.weekDates(2027, 1)[3]).toBe('2027-01-07');
    expect(monthOfWeek(2027, 1)).toEqual({ year: 2027, month: 1 });
    // ISO week 1 of 2026 starts Mon 29 Dec 2025 but its Thursday is 1 Jan 2026
    expect(monthOfWeek(2026, 1)).toEqual({ year: 2026, month: 1 });
  });
});

describe('allocationVsUtilization', () => {
  it('October 2026 (weeks 43-44)', () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 10);
    expect(r.monthLabel).toBe('OCTOBER');
    expect(r.weekNumbers).toEqual([43, 44]);
    expect(r.rows.map((x) => x.label)).toEqual(['MAERSK', 'HAPAG', 'HELLMAN', 'ONE', 'FML-ONE']);
    expect(r.rows.map((x) => x.utilTeu)).toEqual([26, 20, 12, 20, 10]);
    expect(r.total.utilTeu).toBe(88);
    expect(r.rows.map((x) => x.logicForecastTeu)).toEqual([54, 45, 36, 45, 20]);
    expect(r.total.logicForecastTeu).toBe(200);
    const exp = [26, 20, 12, 20, 10].map((n) => n / 88);
    r.rows.forEach((x, i) => expect(x.utilPct as number).toBeCloseTo(exp[i], 6));
    expect(allocationVsUtilizationRows(r).slice(2, 7).map((x) => x[3])).toEqual(['30%', '23%', '14%', '23%', '11%']);
    expect(r.rows.map((x) => x.allocPct)).toEqual([0.3, 0.25, 0.2, 0.25, null]);
    expect(r.total.utilPct).toBe(1);
    expect(r.total.allocPct).toBe(1);
  });
  it('November 2026 (week 45 only): no utilization, forecast only', () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 11);
    expect(r.weekNumbers).toEqual([45]);
    expect(r.rows.map((x) => x.utilTeu)).toEqual([0, 0, 0, 0, 0]);
    r.rows.forEach((x) => expect(x.utilPct).toBeNull());
    expect(r.total.utilPct).toBeNull();
    expect(r.rows.map((x) => x.logicForecastTeu)).toEqual([16, 14, 11, 14, 10]);
    expect(r.total.logicForecastTeu).toBe(65);
    const rows = allocationVsUtilizationRows(r);
    expect(rows[2]).toEqual(['MAERSK', 0, 16, '', '30%']);
    expect(rows[7]).toEqual(['TOTAL', 0, 65, '', '100%']);
  });
  it('a month without weeks gives an empty report without throwing', () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 3);
    expect(r.weekNumbers).toEqual([]);
    expect(r.total.utilTeu).toBe(0);
    expect(r.total.logicForecastTeu).toBe(0);
    expect(r.rows).toHaveLength(5);
    const empty = allocationVsUtilization([], cfg, null, 2026, 1);
    expect(empty.total.utilTeu).toBe(0);
  });
  it('custom percentages flow into allocation and total', () => {
    const { weeks, daily } = data();
    const c2 = { ...cfg, pct_maersk: 40, pct_hapag: 20, pct_hellman: 10, pct_one: 20 };
    const r = allocationVsUtilization(weeks, c2, daily, 2026, 10);
    expect(r.rows.map((x) => x.allocPct)).toEqual([0.4, 0.2, 0.1, 0.2, null]);
    expect(r.total.allocPct).toBeCloseTo(0.9, 9);
    expect(allocationVsUtilizationRows(r)[7][4]).toBe('90%');
    expect(r.rows[0].logicForecastTeu).toBe(Math.round(100 * 0.4) + Math.round(79 * 0.4));
  });
  it('reflects unsaved edits (in-memory weeks)', () => {
    const { weeks, daily } = data();
    const edited = weeks.map((w) => (w.week === 44 ? { ...w, maersk_util: 4 } : w));
    expect(allocationVsUtilization(edited, cfg, daily, 2026, 10).rows[0].utilTeu).toBe(30);
  });
  it('file name and sheet rows layout', () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 10);
    expect(allocationVsUtilizationFileName(r, 'xlsx')).toBe('allocation-vs-utilization_OCTOBER-2026.xlsx');
    expect(allocationVsUtilizationFileName(r, 'csv')).toBe('allocation-vs-utilization_OCTOBER-2026.csv');
    const rows = allocationVsUtilizationRows(r);
    expect(rows[0]).toEqual(['Summary:']);
    expect(rows[1]).toEqual(['OCTOBER', 'UTILIZATION (TEU)', 'LOGIC FORECAST (TEU)', 'UTILIZATION (%)', 'ALLOCATION (%)']);
    expect(rows[6]).toEqual(['FML-ONE', 10, 20, '11%', 'N/A']);
    expect(rows[7]).toEqual(['TOTAL', 88, 200, '100%', '100%']);
  });
});

describe('monthsAvailable / weeksLabel', () => {
  it('lists months with data, sorted, with their weeks', () => {
    const { weeks } = data();
    const extra = [CAT.newWeek(2027, 1, cfg), CAT.newWeek(2026, 53, cfg), ...weeks.slice().reverse()];
    const m = monthsAvailable(extra);
    expect(m.map((x) => x.key)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(m[0].label).toBe('October 2026');
    expect(m[0].weekNumbers).toEqual([43, 44]);
    expect(monthsAvailable([])).toEqual([]);
  });
  it('weeksLabel', () => {
    expect(weeksLabel([43, 44])).toBe('weeks 43-44');
    expect(weeksLabel([45])).toBe('week 45');
    expect(weeksLabel([1, 3])).toBe('weeks 1, 3');
  });
});

describe('buildAllocationVsUtilizationXlsx', () => {
  it('writes the template look (values, fills, % format, N/A)', async () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 10);
    const bytes = await buildAllocationVsUtilizationXlsx(r);
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('Sheet1')!;
    expect(ws).toBeTruthy();
    const fill = (a: string) => (ws.getCell(a).fill as { fgColor?: { argb?: string } }).fgColor?.argb;
    expect(ws.getCell('A1').value).toBe('Summary:');
    expect(ws.getCell('A2').value).toBe('OCTOBER');
    expect(fill('A2')).toBe('FF92D050');
    ['B2', 'C2', 'D2', 'E2'].forEach((a) => expect(fill(a)).toBe('FF002060'));
    expect(ws.getCell('B2').value).toBe('UTILIZATION (TEU)');
    expect(ws.getCell('E2').value).toBe('ALLOCATION (%)');
    expect(ws.getCell('B2').font.color?.argb).toBe('FFFFFFFF');
    expect(ws.getCell('B2').font.bold).toBe(true);
    ['MAERSK', 'HAPAG', 'HELLMAN', 'ONE', 'FML-ONE'].forEach((n, i) => {
      expect(ws.getCell(3 + i, 1).value).toBe(n);
      expect(fill('A' + (3 + i))).toBe('FFBDD7EE');
    });
    expect([3, 4, 5, 6, 7].map((row) => ws.getCell(row, 2).value)).toEqual([26, 20, 12, 20, 10]);
    expect([3, 4, 5, 6, 7].map((row) => ws.getCell(row, 3).value)).toEqual([54, 45, 36, 45, 20]);
    expect(ws.getCell('D3').numFmt).toBe('0%');
    expect(ws.getCell('D3').value as number).toBeCloseTo(26 / 88, 6);
    expect(ws.getCell('E3').value).toBe(0.3);
    expect(ws.getCell('E3').numFmt).toBe('0%');
    expect(ws.getCell('E7').value).toBe('N/A');
    expect(ws.getCell('A8').value).toBe('TOTAL');
    ['A8', 'B8', 'C8', 'D8', 'E8'].forEach((a) => expect(fill(a)).toBe('FF002060'));
    expect(ws.getCell('B8').value).toBe(88);
    expect(ws.getCell('C8').value).toBe(200);
    expect(ws.getCell('D8').value).toBe(1);
    expect(ws.getCell('E8').value).toBe(1);
    expect(ws.getCell('E8').numFmt).toBe('0%');
    expect(ids.length).toBe(5);
  });
  it('writes blank utilization % when there is no utilization', async () => {
    const { weeks, daily } = data();
    const r = allocationVsUtilization(weeks, cfg, daily, 2026, 11);
    const bytes = await buildAllocationVsUtilizationXlsx(r);
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('Sheet1')!;
    expect(ws.getCell('D3').value ?? null).toBeNull();
    expect(ws.getCell('D8').value ?? null).toBeNull();
    expect(ws.getCell('B8').value).toBe(0);
  });
});
