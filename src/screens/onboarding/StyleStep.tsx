import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { applyAnswers, type PlanAnswers } from '@/domain/plan';
import { GROUP_LABEL, GROUPS, LOW_FREQ, STYLE_NAME, eligibleStyles, frequency, pickStyle, readHistory, styleLayout, weeklyTargets, type DayLayout, type FixedStyle, type StyleId, type Targets } from '@/domain/plan/v2';
import { List } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useData } from '@/store/app';
import { useOnboarding } from '@/store/onboarding';
import { CustomPairsSheet } from './CustomPairsSheet';
import { NextButton, StepFooter, StepTitle } from './parts';

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const times = (x: number) => {
  const r = Math.round(x * 2) / 2;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}×`;
};

/** One line on how often a layout trains muscles, and an amber note when a focus muscle gets about once a week. */
function describe(layout: DayLayout[], days: number, t: Targets): { often: string; low: string | null } {
  const f = frequency(layout, days);
  const trained = GROUPS.filter((g) => t.sets[g] > 0);
  const low = [...t.focus].filter((g) => t.sets[g] > 0 && f[g] < LOW_FREQ);
  return {
    often: `Each muscle ~${times(median(trained.map((g) => f[g])))} a week`,
    low: low.length ? `${GROUP_LABEL[low[0]]} trained ~${times(f[low[0]])} a week. Fine for holding, slower for growing.` : null,
  };
}

interface Option {
  value: StyleId | 'auto';
  label: string;
  days: string;
  often: string;
  low: string | null;
}

export function StyleStep() {
  const data = useData();
  const answers = useOnboarding((s) => s.answers);
  const [now] = useState(() => new Date().toISOString());
  const [editing, setEditing] = useState(false);
  const days = answers.daysPerWeek ?? data.profile.daysPerWeek;
  const chosen = answers.style ?? 'auto';

  const targets = useMemo(() => {
    const profile = applyAnswers(data, answers as PlanAnswers, now).profile;
    return weeklyTargets(profile, readHistory(data, now));
    // `data` changes on every store write; targets only depend on the answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, now]);

  const options: Option[] = useMemo(() => {
    const auto = pickStyle(days, targets);
    const fixed = eligibleStyles(days).filter((s): s is FixedStyle => s !== 'custom');
    const pairs = answers.customPairs;
    return [
      { value: 'auto' as const, label: 'Let Repwise pick', days: `Right now: ${STYLE_NAME[auto]}`, ...describe(styleLayout(auto, days), days, targets) },
      ...fixed.map((id) => {
        const layout = styleLayout(id, days);
        return { value: id, label: STYLE_NAME[id], days: layout.map((d) => d.title).join(' / '), ...describe(layout, days, targets) };
      }),
      pairs?.length
        ? { value: 'custom' as const, label: STYLE_NAME.custom, days: pairs.map((d) => d.title).join(' / '), ...describe(pairs, days, targets) }
        : { value: 'custom' as const, label: STYLE_NAME.custom, days: 'Choose which muscles go on which day', often: 'Advanced', low: null },
    ];
  }, [days, targets, answers.customPairs]);

  const pick = (value: StyleId | 'auto') => {
    if (value === 'custom') setEditing(true);
    else useOnboarding.getState().set({ style: value });
  };

  return (
    <>
      <StepTitle title="How should your week be split?" subtitle="Only styles that fit your days are shown. You can regenerate the plan after." />
      <List>
        {options.map((o) => {
          const on = chosen === o.value;
          return (
            <button
              key={o.value}
              aria-pressed={on}
              onClick={() => pick(o.value)}
              className="flex min-h-[52px] w-full items-center gap-3 pl-4 text-left active:bg-fill-2 [&:not(:last-child)>:last-child]:border-b [&:not(:last-child)>:last-child]:border-sep"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
                <div className="min-w-0 flex-1">
                  <div className={cn('text-body', on && 'font-semibold')}>{o.label}</div>
                  <div className="text-footnote text-label-2">{o.days}</div>
                  <div className="text-footnote text-label-2">{o.often}</div>
                  {o.low && <div className="text-footnote text-orange">{o.low}</div>}
                </div>
                <Check className={cn('size-5 shrink-0 text-blue transition-opacity', on ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
              </div>
            </button>
          );
        })}
      </List>
      <CustomPairsSheet
        open={editing}
        onClose={() => setEditing(false)}
        initial={answers.customPairs ?? styleLayout('pairs', Math.min(6, Math.max(4, days)))}
        targets={targets}
        days={days}
        onSave={(pairs) => {
          useOnboarding.getState().set({ style: 'custom', customPairs: pairs });
          setEditing(false);
        }}
      />
      <StepFooter>
        <NextButton
          label="See my plan"
          onClick={() => {
            useOnboarding.getState().set({ style: chosen });
            useOnboarding.getState().next();
          }}
        />
      </StepFooter>
    </>
  );
}
