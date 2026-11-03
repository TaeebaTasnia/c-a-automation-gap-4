import type { StoreState } from '@/lib/store';
import s from './ui.module.css';

const LABEL: Record<StoreState, string> = {
  loading: 'Loading',
  dirty: 'Unsaved changes',
  saving: 'Saving',
  saved: 'All changes saved',
  error: 'Save failed',
};

export default function SavePill({ state, className }: { state: StoreState; className?: string }) {
  return (
    <span className={`${s.pill} ${className || ''}`} data-state={state} role="status" aria-live="polite">
      <span className={s.pillDot} aria-hidden="true" />
      <span>{LABEL[state]}</span>
    </span>
  );
}
