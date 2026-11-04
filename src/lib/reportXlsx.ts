/* Builds the Allocation vs. Utilization workbook in the boss's template look (no DOM; runs in Node and browser).
 * exceljs is imported dynamically so it never lands in the initial bundle. */
import type { Borders, Fill, Font, Alignment } from 'exceljs';
import { REPORT_HEADERS, type AllocUtilReport } from './reports';

const GREEN = 'FF92D050';
const NAVY = 'FF002060';
const LIGHT_BLUE = 'FFBDD7EE';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const medium = { style: 'medium' as const, color: { argb: BLACK } };
const FONT = 'Aptos';
const center: Partial<Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
// Template borders: first column carries left+right(+top on header), other columns only right/bottom(+top on header).
const boxA: Partial<Borders> = { left: medium, right: medium, bottom: medium };
const boxRest: Partial<Borders> = { right: medium, bottom: medium };
const headA: Partial<Borders> = { left: medium, right: medium, top: medium, bottom: medium };
const headRest: Partial<Borders> = { right: medium, top: medium, bottom: medium };

export async function buildAllocationVsUtilizationXlsx(report: AllocUtilReport): Promise<Uint8Array> {
  const mod = await import('exceljs');
  // exceljs is CommonJS: depending on the bundler the constructor is a named or a default-interop export.
  const Workbook = (mod.Workbook ?? (mod as unknown as { default: typeof mod }).default.Workbook);
  const wb = new Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.columns = [{ width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const a1 = ws.getCell('A1');
  a1.value = report.title;
  a1.font = { name: FONT, size: 11, bold: true };
  a1.alignment = { vertical: 'middle' };

  const font = (bold: boolean, argb: string): Partial<Font> => ({ name: FONT, size: 11, bold, color: { argb } });

  // Row 2: month (green) + navy headers
  ws.getRow(2).height = 44;
  const m = ws.getCell('A2');
  m.value = report.monthLabel;
  m.fill = solid(GREEN); m.font = font(true, BLACK); m.alignment = center; m.border = headA;
  REPORT_HEADERS.forEach((h, i) => {
    const c = ws.getCell(2, i + 2);
    c.value = h;
    c.fill = solid(NAVY); c.font = font(true, WHITE); c.alignment = center; c.border = headRest;
  });

  // Rows 3-7: carriers
  report.rows.forEach((r, i) => {
    const row = i + 3;
    const a = ws.getCell(row, 1);
    a.value = r.label; a.fill = solid(LIGHT_BLUE); a.font = font(false, BLACK); a.alignment = center; a.border = boxA;
    const put = (col: number, value: number | string | null, pct: boolean, white: boolean) => {
      const c = ws.getCell(row, col);
      c.value = value;
      if (white) c.fill = solid(WHITE);
      c.font = font(false, BLACK); c.alignment = center; c.border = boxRest;
      if (pct) c.numFmt = '0%';
    };
    put(2, r.utilTeu, false, true);
    put(3, r.logicForecastTeu, false, true);
    put(4, r.utilPct, true, true);
    put(5, r.allocPct == null ? 'N/A' : r.allocPct, r.allocPct != null, false); // template: allocation cells have no fill
  });

  // Row 8: TOTAL (navy)
  const t = report.rows.length + 3;
  const totals: (number | string | null)[] = ['TOTAL', report.total.utilTeu, report.total.logicForecastTeu, report.total.utilPct, report.total.allocPct];
  totals.forEach((v, i) => {
    const c = ws.getCell(t, i + 1);
    c.value = v;
    c.fill = solid(NAVY); c.font = font(true, WHITE); c.alignment = center;
    c.border = i === 0 ? boxA : boxRest;
    if (i >= 3) c.numFmt = '0%';
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
