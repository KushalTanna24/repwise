import { useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import { applyAnswers, type PlanAnswers } from '@/domain/plan';
import {
  STYLE_BLURB,
  STYLE_NAME,
  eligibleStyles,
  pickStyle,
  readHistory,
  styleInsight,
  styleLayout,
  weeklyTargets,
  type FixedStyle,
  type StyleId,
  type StyleInsight,
} from '@/domain/plan/v2';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useData } from '@/store/app';
import { useOnboarding } from '@/store/onboarding';
import { CustomPairsSheet } from './CustomPairsSheet';
import { NextButton, StepFooter, StepTitle } from './parts';

interface Option {
  value: StyleId | 'auto';
  label: string;
  blurb: string;
  insight: StyleInsight | null;
  recommended?: boolean;
}

function OptionRow({ o, on, open, onPick, onToggle, onEdit }: { o: Option; on: boolean; open: boolean; onPick: () => void; onToggle: () => void; onEdit?: () => void }) {
  return (
    <div className="pl-4 [&:not(:last-child)>div]:border-b [&:not(:last-child)>div]:border-sep">
      <div className="py-3 pr-4">
        <button aria-pressed={on} onClick={onPick} className="flex w-full items-start gap-3 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-body', on && 'font-semibold')}>{o.label}</span>
              {o.recommended && <span className="rounded-full bg-blue/12 px-2 py-0.5 text-caption font-semibold text-blue">Recommended</span>}
            </div>
            <p className="mt-0.5 text-footnote text-label-2">{o.blurb}</p>
            {o.recommended && o.insight && <p className="mt-1 text-footnote font-medium text-blue">{o.insight.why}</p>}
            {o.insight?.focus && <p className="mt-1 text-footnote text-label-2">{o.insight.focus}</p>}
            {o.insight?.warning && <p className="mt-1 text-footnote text-orange">{o.insight.warning}</p>}
          </div>
          <Check className={cn('mt-0.5 size-5 shrink-0 text-blue transition-opacity', on ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
        </button>
        <div className="mt-2 flex gap-4">
          {o.insight && (
            <button onClick={onToggle} aria-expanded={open} className="flex items-center gap-1 text-footnote font-medium text-blue">
              {open ? 'Hide days' : 'Show days'}
              <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="flex items-center gap-1 text-footnote font-medium text-blue">
              <Pencil className="size-3.5" /> {o.insight ? 'Edit days' : 'Build your days'}
            </button>
          )}
        </div>
        {open && o.insight && (
          <ol className="mt-2 grid gap-1.5 rounded-[12px] bg-fill-2 p-3">
            {o.insight.days.map((d, i) => (
              <li key={i} className="text-footnote">
                <span className="font-semibold">
                  Day {i + 1} · {d.title}
                </span>
                <span className="text-label-2"> — {d.muscles}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function StyleStep() {
  const data = useData();
  const answers = useOnboarding((s) => s.answers);
  const [now] = useState(() => new Date().toISOString());
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const days = answers.daysPerWeek ?? data.profile.daysPerWeek;
  const chosen = answers.style ?? 'auto';

  const targets = useMemo(() => {
    const profile = applyAnswers(data, answers as PlanAnswers, now).profile;
    return weeklyTargets(profile, readHistory(data, now));
    // `data` changes on every store write; targets only depend on the answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, now]);

  const { auto, options } = useMemo(() => {
    const auto = pickStyle(days, targets);
    const fixed = eligibleStyles(days).filter((s): s is FixedStyle => s !== 'custom' && s !== auto);
    const pairs = answers.customPairs;
    const options: Option[] = [
      { value: 'auto', label: STYLE_NAME[auto], blurb: STYLE_BLURB[auto], insight: styleInsight(styleLayout(auto, days), days, targets), recommended: true },
      ...fixed.map((id) => ({ value: id, label: STYLE_NAME[id], blurb: STYLE_BLURB[id], insight: styleInsight(styleLayout(id, days), days, targets) })),
      { value: 'custom', label: STYLE_NAME.custom, blurb: STYLE_BLURB.custom, insight: pairs?.length ? styleInsight(pairs, days, targets) : null },
    ];
    return { auto, options };
  }, [days, targets, answers.customPairs]);

  // Picking the recommended style by name is the same choice as letting Repwise pick.
  const selected = chosen === auto ? 'auto' : chosen;
  const pick = (value: StyleId | 'auto') => {
    if (value === 'custom' && !answers.customPairs?.length) setEditing(true);
    else useOnboarding.getState().set({ style: value });
  };

  return (
    <>
      <StepTitle title="How should your week be split?" subtitle={`Styles that fit ${days} days a week. Tap Show days to see what each day trains.`} />
      <List>
        {options.map((o) => (
          <OptionRow
            key={o.value}
            o={o}
            on={selected === o.value}
            open={open === o.value}
            onPick={() => pick(o.value)}
            onToggle={() => setOpen(open === o.value ? null : o.value)}
            onEdit={o.value === 'custom' ? () => setEditing(true) : undefined}
          />
        ))}
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
            useOnboarding.getState().set({ style: selected });
            useOnboarding.getState().next();
          }}
        />
        {selected !== 'auto' && (
          <Button variant="plain" onClick={() => useOnboarding.getState().set({ style: 'auto' })}>
            Use the recommended split
          </Button>
        )}
      </StepFooter>
    </>
  );
}
