'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTracker } from '@/lib/useTracker';
import Hero from '@/components/tracker/Hero';
import Toolbar from '@/components/tracker/Toolbar';
import DataArea from '@/components/tracker/DataArea';
import ExportPanel from '@/components/tracker/ExportPanel';
import ExportDialog from '@/components/tracker/ExportDialog';
import SettingsDialog from '@/components/tracker/SettingsDialog';
import Skeleton from '@/components/tracker/Skeleton';
import Toast from '@/components/tracker/Toast';
import EmptyState from '@/components/tracker/EmptyState';
import KpiRow from '@/components/tracker/visuals/KpiRow';
import CarrierCards from '@/components/tracker/visuals/CarrierCards';
import WeeklyChart from '@/components/tracker/visuals/WeeklyChart';
import CarrierChart from '@/components/tracker/visuals/CarrierChart';
import ShareBar from '@/components/tracker/visuals/ShareBar';
import s from './tracker.module.css';

export default function TrackerPage() {
  const tr = useTracker();
  const [dialog, setDialog] = useState<'export' | 'settings' | null>(null);
  const ready = tr.status === 'ready';

  return (
    <div className={s.page}>
      <Hero t={tr} />
      {!ready ? (
        <Skeleton />
      ) : (
        <>
          <Toolbar t={tr} onExport={() => setDialog('export')} onSettings={() => setDialog('settings')} />
          <main className={s.main}>
            {tr.selWeek && tr.calc ? (
              <>
                <KpiRow week={tr.selWeek} calc={tr.calc} cfg={tr.cfg} daily={tr.daily} today={tr.today} />
                <CarrierCards week={tr.selWeek} calc={tr.calc} cfg={tr.cfg} />
              </>
            ) : (
              <EmptyState
                title={tr.yearWeeks.length ? 'Pick a week' : 'No weeks yet'}
                text={tr.yearWeeks.length ? 'Choose a week in the toolbar to see its numbers.' : 'Add a week from the toolbar, or load the sample data to see how the tracker works.'}
                onSample={tr.yearWeeks.length ? undefined : tr.loadSample}
              />
            )}
            <div className={s.charts}>
              <WeeklyChart weeks={tr.yearWeeks} cfg={tr.cfg} daily={tr.daily} selectedWeek={tr.sel.week} onSelectWeek={tr.selectWeek} />
              <CarrierChart calc={tr.calc} weekLabel={tr.selWeek ? `Week ${tr.selWeek.week}` : ''} />
            </div>
            <ShareBar calc={tr.calc} cfg={tr.cfg} />
            <DataArea tr={tr} />
            <section aria-labelledby="export-heading">
              <h2 id="export-heading" className={s.sectionTitle}>Export</h2>
              <p className={s.sectionHint}>Download or copy the weekly summary and the date-wise detail for a range of weeks.</p>
              <ExportPanel tr={tr} />
            </section>
          </main>
          {dialog === 'export' ? <ExportDialog tr={tr} onClose={() => setDialog(null)} /> : null}
          {dialog === 'settings' ? <SettingsDialog tr={tr} onClose={() => setDialog(null)} /> : null}
        </>
      )}
      <footer className={s.footer}>
        Data is saved in this browser. <Link href="/">Back to the harbour</Link>
      </footer>
      <Toast toast={tr.toast} />
    </div>
  );
}
