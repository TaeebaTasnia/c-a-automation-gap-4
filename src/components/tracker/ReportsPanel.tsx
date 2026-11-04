'use client';

import { useMemo, useState } from 'react';
import { CARRIERS, toCsv, toTsv } from '@/lib/logic';
import {
  allocationVsUtilization, allocationVsUtilizationFileName, allocationVsUtilizationRows,
  monthOfWeek, monthKey, monthsAvailable, pctText, weeksLabel, REPORT_HEADERS,
  type AllocUtilReport, type AllocUtilRow,
} from '@/lib/reports';
import type { Tracker } from '@/lib/useTracker';
import { copyText, downloadBlob, downloadCsv } from './download';
import EmptyState from './EmptyState';
import s from './ui.module.css';
import r from './reports.module.css';

/* TODO(reports): the boss's reporting set is three extracts. Only (3) is built; add the others as more cards below.
 *  - Monthly report extract: format not provided yet.
 *  - Capacity Status (WEEK 45-47 sample): sample file not provided yet.
 * Do not invent their layouts; each card should get its own builder in src/lib/reports.ts (+ xlsx builder) and a card here. */

const colorOf = (id: string) => CARRIERS.find((c) => c.id === id)?.id ?? 'fml';

function diffLabel(row: AllocUtilRow): string {
  if (row.allocPct == null) return 'no allocation target';
  if (row.utilPct == null) return 'no utilization yet';
  const d = Math.round((row.utilPct - row.allocPct) * 100);
  return (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + ' pp vs allocation';
}

function Bars({ report }: { report: AllocUtilReport }) {
  const vals = report.rows.flatMap((x) => [x.utilPct ?? 0, x.allocPct ?? 0]);
  const scale = Math.max(0.4, Math.ceil(Math.max(...vals) * 10) / 10);
  const w = (v: number | null) => (v == null ? 0 : Math.min(100, (v / scale) * 100)) + '%';
  return (
    <div className={r.bars} role="list" aria-label="Utilization versus allocation by carrier">
      {report.rows.map((x) => (
        <div key={x.id} className={r.barRow} role="listitem" data-carrier={colorOf(x.id)}
          aria-label={`${x.label}: utilization ${x.utilPct == null ? 'none' : pctText(x.utilPct)}, allocation ${x.allocPct == null ? 'not applicable' : pctText(x.allocPct)}`}>
          <div className={r.barName}>{x.label}</div>
          <div className={r.barPair}>
            <div className={r.barLine}>
              <span className={r.barKey}>Utilization %</span>
              <div className={r.track}>
                <div className={r.fillUtil} style={{ width: w(x.utilPct) }} />
                {x.allocPct != null ? <div className={r.marker} style={{ left: w(x.allocPct) }} title={`Allocation target ${pctText(x.allocPct)}`} /> : null}
              </div>
              <span className={r.barVal}>{x.utilPct == null ? '–' : pctText(x.utilPct)}</span>
            </div>
            <div className={r.barLine}>
              <span className={r.barKey}>Allocation %</span>
              <div className={r.track}>
                <div className={r.fillAlloc} style={{ width: w(x.allocPct) }} />
              </div>
              <span className={r.barVal}>{x.allocPct == null ? 'N/A' : pctText(x.allocPct)}</span>
            </div>
          </div>
          <div className={r.diff}>{diffLabel(x)}</div>
        </div>
      ))}
    </div>
  );
}

function SummaryGrid({ report }: { report: AllocUtilReport }) {
  return (
    <div className={r.tableWrap} tabIndex={0} role="region" aria-label="Allocation vs Utilization summary table">
      <table className={r.table}>
        <caption className={r.srOnly}>{report.title} {report.monthLabel} {report.year}</caption>
        <thead>
          <tr>
            <th scope="col" className={r.month}>{report.monthLabel}</th>
            {REPORT_HEADERS.map((h) => <th key={h} scope="col" className={r.head}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((x) => (
            <tr key={x.id}>
              <th scope="row" className={r.carrier} data-carrier={x.id}>{x.label}</th>
              <td>{x.utilTeu}</td>
              <td>{x.logicForecastTeu}</td>
              <td>{pctText(x.utilPct)}</td>
              <td>{x.allocPct == null ? 'N/A' : pctText(x.allocPct)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={r.totalCell}>TOTAL</th>
            <td className={r.totalCell}>{report.total.utilTeu}</td>
            <td className={r.totalCell}>{report.total.logicForecastTeu}</td>
            <td className={r.totalCell}>{pctText(report.total.utilPct)}</td>
            <td className={r.totalCell}>{pctText(report.total.allocPct)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ReportsPanel({ tr }: { tr: Tracker }) {
  const options = useMemo(() => monthsAvailable(tr.weekly), [tr.weekly]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Default: month of the selected week, else the latest month that has data.
  const selKey = tr.selWeek ? (() => { const m = monthOfWeek(tr.selWeek.year, tr.selWeek.week); return monthKey(m.year, m.month); })() : null;
  const current = options.find((o) => o.key === chosen)
    || options.find((o) => o.key === selKey)
    || options[options.length - 1];

  const report = useMemo(
    () => (current ? allocationVsUtilization(tr.weekly, tr.cfg, tr.daily, current.year, current.month) : null),
    [current, tr.weekly, tr.cfg, tr.daily],
  );

  if (!current || !report) {
    return <EmptyState title="No data to report on yet" text="Add a week from the toolbar, or load the sample data, then come back here for the monthly extracts." onSample={tr.loadSample} />;
  }

  const rows = () => allocationVsUtilizationRows(report);
  const downloadXlsx = async () => {
    setBusy(true);
    try {
      const { buildAllocationVsUtilizationXlsx } = await import('@/lib/reportXlsx');
      const bytes = await buildAllocationVsUtilizationXlsx(report);
      const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (downloadBlob(allocationVsUtilizationFileName(report, 'xlsx'), blob)) tr.showToast(`Downloading ${report.monthLabel} ${report.year} report...`);
      else tr.showToast('Download blocked by browser. Use the Copy button instead');
    } catch (e) {
      tr.showToast('Could not build the Excel file: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  const downloadCsvFile = () => {
    if (downloadCsv(allocationVsUtilizationFileName(report, 'csv'), toCsv(rows()))) tr.showToast('Downloading CSV...');
    else tr.showToast('Download blocked by browser. Use the Copy button instead');
  };
  const copy = async () => {
    const ok = await copyText(toTsv(rows()));
    tr.showToast(ok ? 'Copied. Paste into Excel or Google Sheets' : 'Copy blocked by the browser. Use Download CSV');
  };

  return (
    <div className={r.wrap}>
      <section className={r.card} aria-labelledby="rep-auv-title">
        <div className={r.cardHead}>
          <div>
            <h3 id="rep-auv-title" className={r.cardTitle}>Allocation vs Utilization</h3>
            <p className={r.cardHint}>Monthly extract in the management format. A week belongs to the month of its Thursday.</p>
          </div>
          <label className={s.fieldLabel}>
            Month
            <select className={s.field} value={current.key} onChange={(e) => setChosen(e.target.value)} aria-label="Report month">
              {options.map((o) => <option key={o.key} value={o.key}>{o.label} · {weeksLabel(o.weekNumbers)}</option>)}
            </select>
          </label>
        </div>

        <SummaryGrid report={report} />

        <h4 className={r.subTitle}>Utilization vs allocation</h4>
        <p className={r.cardHint}>Bars share one scale. The tick on the utilization bar marks the allocation target.</p>
        <Bars report={report} />

        <div className={r.actions}>
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => { void downloadXlsx(); }} disabled={busy}>
            {busy ? 'Preparing...' : 'Download Excel (.xlsx)'}
          </button>
          <button type="button" className={s.btn} onClick={downloadCsvFile}>Download CSV</button>
          <button type="button" className={s.btn} onClick={() => { void copy(); }}>Copy for Excel / Sheets</button>
          <span className={r.count}>{report.monthLabel} {report.year} · {weeksLabel(report.weekNumbers)}</span>
        </div>
      </section>
    </div>
  );
}
