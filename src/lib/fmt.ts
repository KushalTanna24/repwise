import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getExercise } from '@/domain/catalogue';
import { toDisplay } from '@/domain/stats';
import type { AppData, Kg } from '@/domain/types';

dayjs.extend(relativeTime);

export const exName = (data: AppData, id: string) => getExercise(id, data.customExercises)?.name ?? (id ? 'Unknown exercise' : 'Pick an exercise');

/** "62.5 kg" / "137.8 lb". */
export const fmtLoad = (kg: Kg | null | undefined, units: 'kg' | 'lb') => (kg == null ? '—' : `${toDisplay(kg, units)} ${units}`);

export const fmtRange = (min: number, max: number, timed = false) => (min === max ? `${min}` : `${min}–${max}`) + (timed ? 's' : '');

/** "Today", "Yesterday", "Tue", "3 Oct". */
export function fmtDay(isoOrDate: string) {
  const d = dayjs(isoOrDate);
  const today = dayjs().startOf('day');
  const diff = today.diff(d.startOf('day'), 'day');
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7 && diff > 0) return d.format('dddd');
  return d.year() === today.year() ? d.format('D MMM') : d.format('D MMM YYYY');
}

export const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const nowIso = () => new Date().toISOString();
