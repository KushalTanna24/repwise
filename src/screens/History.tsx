import { useEffect, useState } from 'react';
import { firstGoalDate, kindsSeen, type GoalKind } from '@/domain/goals';
import { Screen } from '@/components/Screen';
import { Empty } from '@/components/ui/card';
import { useToday } from '@/lib/useToday';
import { useData } from '@/store/app';
import { Calendar } from './history/Calendar';
import { DayCard } from './history/DayCard';
import { FilterChips } from './history/FilterChips';
import { StreakHeader } from './history/StreakHeader';
import { MuscleMap } from './history/MuscleMap';

export function History() {
  const data = useData();
  const today = useToday();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<GoalKind | null>(null);
  // Follow the date across midnight unless another day was picked.
  useEffect(() => setDay(today), [today]);
  const kinds = kindsSeen(data);
  const empty = !firstGoalDate(data) && data.challenges.length === 0;

  return (
    <Screen title="History">
      <StreakHeader data={data} today={today} />
      <MuscleMap data={data} today={today} />
      <Calendar data={data} today={today} selected={day} onSelect={setDay} filter={filter} kinds={kinds} />
      <FilterChips kinds={kinds} value={filter} onChange={setFilter} />
      {empty ? <Empty title="No lit days yet" body="Your first lit day starts the flame. Log a workout, hit your water, or take your stack." /> : <DayCard data={data} date={day} />}
    </Screen>
  );
}
