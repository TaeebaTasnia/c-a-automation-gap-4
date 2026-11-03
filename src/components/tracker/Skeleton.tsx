import s from './ui.module.css';

export default function Skeleton() {
  return (
    <div className={s.skeleton} aria-busy="true" aria-label="Loading tracker">
      <div className={s.skBlock} />
      <div className={s.skBlock} />
      <div className={s.skBlock} style={{ height: 220 }} />
    </div>
  );
}
