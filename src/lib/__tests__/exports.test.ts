import { describe, expect, it } from 'vitest';
import * as CAT from '../logic';
import { buildDatasets, buildRangeExport, rangeFileName, weeksInRange } from '../exports';

const cfg: CAT.Config = { ...CAT.DEFAULT_CFG };
function data() {
  const s = CAT.sampleData(cfg);
  const daily: CAT.DailyMap = {};
  s.daily.forEach((r) => { daily[r.date] = r; });
  return { weeks: s.weekly, daily };
}

describe('buildRangeExport', () => {
  it('equals toCsv/toTsv of exportRange for the filtered weeks', () => {
    const { weeks, daily } = data();
    const e = buildRangeExport(weeks, 2026, 43, 44, cfg, daily);
    const ref = CAT.exportRange(weeks.filter((w) => w.week <= 44), cfg, daily);
    expect(e.count).toBe(2);
    expect(e.csv).toBe(CAT.toCsv(ref.rows));
    expect(e.tsv).toBe(CAT.toTsv(ref.rows));
    expect(e.csv.startsWith('﻿WEEKLY SUMMARY')).toBe(true);
    expect(ref.wr.length).toBe(2);
    expect(ref.dr.length).toBe(14);
    expect(e.fileName).toBe('carrier-utilization_2026_W43-W44.csv');
  });
  it('reflects unsaved in-memory edits', () => {
    const { weeks, daily } = data();
    const edited = weeks.map((w) => (w.week === 43 ? { ...w, forecast: 200 } : w));
    const a = buildRangeExport(weeks, 2026, 43, 43, cfg, daily).csv;
    const b = buildRangeExport(edited, 2026, 43, 43, cfg, daily).csv;
    expect(a).not.toBe(b);
  });
  it('empty range has zero weeks', () => {
    const { weeks, daily } = data();
    expect(buildRangeExport(weeks, 2025, 1, 5, cfg, daily).count).toBe(0);
    expect(weeksInRange(weeks, 2026, 50, 53)).toEqual([]);
  });
  it('rangeFileName', () => { expect(rangeFileName(2026, 1, 9)).toBe('carrier-utilization_2026_W1-W9.csv'); });
});

describe('buildDatasets', () => {
  it('weekly and daily datasets match logic output over all data', () => {
    const { weeks, daily } = data();
    const [w, d] = buildDatasets(weeks, cfg, daily, '2026-11-03');
    expect(w.fileName).toBe('carrier-weekly-2026-11-03.csv');
    expect(d.fileName).toBe('carrier-daily-2026-11-03.csv');
    expect(w.csv).toBe(CAT.toCsv(CAT.weeklyRows(weeks, cfg, daily)));
    expect(d.tsv).toBe(CAT.toTsv(CAT.dailyRows(daily, cfg)));
    expect(w.desc).toContain('3 weeks');
    expect(d.desc).toContain('7 days');
  });
});
