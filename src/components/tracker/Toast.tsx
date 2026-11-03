import type { Toast as ToastData } from '@/lib/useTracker';
import s from './ui.module.css';

export default function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div aria-live="polite" role="status">
      {toast ? <div key={toast.id} className={s.toast}>{toast.msg}</div> : null}
    </div>
  );
}
