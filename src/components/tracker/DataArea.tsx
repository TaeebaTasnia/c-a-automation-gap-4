'use client';

import type { KeyboardEvent } from 'react';
import type { Tab, Tracker } from '@/lib/useTracker';
import AllocationTable from './AllocationTable';
import DailyTable from './DailyTable';
import SummaryTable from './SummaryTable';
import ReportsPanel from './ReportsPanel';
import EmptyState from './EmptyState';
import d from './dataarea.module.css';

const TABS: { id: Tab; label: string }[] = [
  { id: 'allocation', label: 'Allocation' },
  { id: 'daily', label: 'Date-wise' },
  { id: 'summary', label: 'Summary' },
  { id: 'reports', label: 'Reports' },
];

export default function DataArea({ tr }: { tr: Tracker }) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((x) => x.id === tr.tab);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else return;
    e.preventDefault();
    tr.setTab(TABS[n].id);
    document.getElementById('tab-' + TABS[n].id)?.focus();
  };

  const empty = tr.yearWeeks.length === 0;
  let body;
  if (tr.tab === 'reports') body = <ReportsPanel tr={tr} />; // reports span all years: no per-year empty state
  else if (empty) {
    body = <EmptyState title={`No weeks for ${tr.sel.year} yet`} text="Add a week from the toolbar, or load the sample data to see how it works." onSample={tr.loadSample} />;
  } else if (tr.tab === 'allocation') body = <AllocationTable tr={tr} />;
  else if (tr.tab === 'daily') body = tr.selWeek ? <DailyTable tr={tr} /> : <EmptyState title="Select a week" text="Pick a week in the toolbar to enter its daily TEUs." />;
  else body = <SummaryTable tr={tr} />;

  const heading = tr.tab === 'daily' && tr.selWeek ? `Week ${tr.selWeek.week} date-wise utilization` : tr.tab === 'summary' ? `${tr.sel.year} weekly summary` : tr.tab === 'reports' ? 'Reports' : `${tr.sel.year} weekly allocation`;
  const hint = tr.tab === 'reports' ? 'Management extracts built from the data above, including unsaved edits' : tr.tab === 'daily' ? 'TEUs used per carrier per day, plus forecast vs actual CBM' : tr.tab === 'summary' ? 'Every week of the year; click a row to select it' : 'Dithered cells are calculated; clean cells are yours to edit';

  return (
    <section className={d.area} aria-labelledby="data-heading">
      <div className={d.head}>
        <div>
          <h2 id="data-heading" className={d.h}>{heading}</h2>
          <p className={d.hint}>{hint}</p>
        </div>
        <div className={d.tabs} role="tablist" aria-label="Data view" onKeyDown={onKey}>
          {TABS.map((x) => (
            <button
              key={x.id}
              id={'tab-' + x.id}
              type="button"
              role="tab"
              aria-selected={tr.tab === x.id}
              aria-controls="tabpanel"
              tabIndex={tr.tab === x.id ? 0 : -1}
              className={`${d.tab} ${tr.tab === x.id ? d.tabOn : ''}`}
              onClick={() => tr.setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div id="tabpanel" role="tabpanel" aria-labelledby={'tab-' + tr.tab}>{body}</div>
    </section>
  );
}
