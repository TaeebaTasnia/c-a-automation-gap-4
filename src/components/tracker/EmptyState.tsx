import s from './ui.module.css';

export default function EmptyState({ title, text, onSample }: { title: string; text: string; onSample?: () => void }) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      <p>{text}</p>
      {onSample ? <button type="button" className={`${s.btn} ${s.primary}`} onClick={onSample}>Load my Week 43–45 data</button> : null}
    </div>
  );
}
