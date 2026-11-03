'use client';
import { calcWeek, num, type WeeklyRow, type Config, type DailyMap } from '@/lib/logic';
import { Legend, GroupedBars, EmptyChart, type Cat } from './chartKit';
import { fmt } from './format';
import s from './WeeklyChart.module.css';

type Props = {
  weeks: WeeklyRow[];
  cfg: Config;
  daily: DailyMap;
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
};

export default function WeeklyChart({ weeks, cfg, daily, selectedWeek, onSelectWeek }: Props) {
  if (!weeks.length) {
    return (
      <figure className={s.fig}>
        <EmptyChart>No weeks for this year yet. Add a week or load sample data to see the weekly picture.</EmptyChart>
      </figure>
    );
  }
  const cats: Cat[] = weeks.map((w) => {
    const c = calcWeek(w, cfg, daily);
    const v: [number, number, number] = [num(w.forecast), c.totalConf, c.totalUtil];
    return {
      key: w.week,
      label: 'W' + w.week,
      values: v,
      selected: w.week === selectedWeek,
      aria: `Week ${w.week}: forecast ${fmt(v[0])}, confirmed ${fmt(v[1])}, utilized ${fmt(v[2])} TEU. Press to select.`,
    };
  });
  const year = weeks[0].year;
  const summary = `Weekly TEUs for ${year}, forecast, confirmed and utilized. ` + cats.map((c) => `W${c.key} ${fmt(c.values[0])}, ${fmt(c.values[1])}, ${fmt(c.values[2])}`).join('; ');
  return (
    <figure className={s.fig}>
      <GroupedBars
        cats={cats}
        title={`Weekly TEUs ${year}`}
        summary={summary}
        onSelect={(k) => onSelectWeek(Number(k))}
      />
      <figcaption className={s.cap}><Legend /></figcaption>
    </figure>
  );
}
