'use client';
import { CARRIERS, type WeekCalc } from '@/lib/logic';
import { Legend, GroupedBars, EmptyChart, type Cat } from './chartKit';
import { fmt } from './format';
import s from './WeeklyChart.module.css';

export default function CarrierChart({ calc, weekLabel }: { calc: WeekCalc | null; weekLabel: string }) {
  if (!calc) {
    return (
      <figure className={s.fig}>
        <EmptyChart>Select a week to compare carriers.</EmptyChart>
      </figure>
    );
  }
  const cats: Cat[] = CARRIERS.map((k) => {
    const v: [number, number, number] = [calc.fc[k.id], calc.conf[k.id], calc.util[k.id]];
    return {
      key: k.id,
      label: k.name,
      swatch: k.color,
      values: v,
      aria: `${k.name}: forecast ${fmt(v[0])}, confirmed ${fmt(v[1])}, utilized ${fmt(v[2])} TEU`,
    };
  });
  const summary = `TEUs per carrier for ${weekLabel}, forecast, confirmed and utilized. ` + cats.map((c) => `${c.label} ${fmt(c.values[0])}, ${fmt(c.values[1])}, ${fmt(c.values[2])}`).join('; ');
  return (
    <figure className={s.fig}>
      <GroupedBars cats={cats} title={`Carriers, ${weekLabel}`} summary={summary} minGroup={52} />
      <figcaption className={s.cap}><Legend /></figcaption>
    </figure>
  );
}
