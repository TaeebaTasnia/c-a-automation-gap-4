/* Pure export builders: the UI only calls these. All content comes from logic.ts. */
import {
  dailyRows, exportRange, toCsv, toTsv, weeklyRows,
  type Config, type CsvCell, type DailyMap, type WeeklyRow,
} from './logic';

export type RangeExport = {
  count: number;
  rows: CsvCell[][];
  csv: string;
  tsv: string;
  fileName: string;
};

export function weeksInRange(weeks: WeeklyRow[], year: number, from: number, to: number): WeeklyRow[] {
  return weeks
    .filter((w) => Number(w.year) === year && w.week >= from && w.week <= to)
    .sort((a, b) => a.week - b.week);
}

export function rangeFileName(year: number, from: number, to: number): string {
  return `carrier-utilization_${year}_W${from}-W${to}.csv`;
}

/** In-page export panel: CSV + TSV of the weekly block and the date-wise block for the chosen range. */
export function buildRangeExport(
  weeks: WeeklyRow[], year: number, from: number, to: number, cfg: Config, daily: DailyMap,
): RangeExport {
  const ws = weeksInRange(weeks, year, from, to);
  const rows = exportRange(ws, cfg, daily).rows;
  return { count: ws.length, rows, csv: toCsv(rows), tsv: toTsv(rows), fileName: rangeFileName(year, from, to) };
}

export type Dataset = {
  id: 'weekly' | 'daily';
  title: string;
  desc: string;
  fileName: string;
  csv: string;
  tsv: string;
};

/** Header export dialog: two datasets over all years. `stamp` is 'yyyy-mm-dd'. */
export function buildDatasets(weeks: WeeklyRow[], cfg: Config, daily: DailyMap, stamp: string): Dataset[] {
  const wRows = weeklyRows(weeks, cfg, daily);
  const dRows = dailyRows(daily, cfg);
  const nd = Object.keys(daily).length;
  return [
    {
      id: 'weekly', title: 'Weekly report',
      desc: `All ${weeks.length} week${weeks.length === 1 ? '' : 's'}: forecast, confirmed, utilized per carrier, totals, deficit/surplus`,
      fileName: `carrier-weekly-${stamp}.csv`, csv: toCsv(wRows), tsv: toTsv(wRows),
    },
    {
      id: 'daily', title: 'Daily data',
      desc: `All ${nd} day${nd === 1 ? '' : 's'}: TEUs per carrier, forecast vs actual CBM`,
      fileName: `carrier-daily-${stamp}.csv`, csv: toCsv(dRows), tsv: toTsv(dRows),
    },
  ];
}
