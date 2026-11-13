import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { applyAnswers, commitPlan, energy, estimateBodyFat, explainV2, generatePlanV2, skipOnboarding, type PlanAnswers } from '@/domain/plan';
import { validateSplit } from '@/domain/training';
import { Button } from '@/components/ui/button';
import { Empty, List, Row, SectionHeader } from '@/components/ui/card';
import { closeSheet, openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useApp, useData } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';
import { useOnboarding } from '@/store/onboarding';
import { EnergyCard } from './EnergyCard';
import { StepFooter, StepTitle } from './parts';

export function Result({ rerun }: { rerun: boolean }) {
  const data = useData();
  const answers = useOnboarding((s) => s.answers) as PlanAnswers & { units?: 'kg' | 'lb' };
  const seed = useOnboarding((s) => s.seed);
  const history = useOnboarding((s) => s.history);
  const [now] = useState(() => new Date().toISOString());

  // Finishing resets the answers while this step is still animating out; render nothing then.
  const ready = answers.heightCm != null && answers.weightKg != null;

  // Built once per answer set so the split shown is the split saved.
  const built = useMemo(() => {
    if (!ready) return null;
    const base = applyAnswers(data, answers, now);
    const applied = { ...base, profile: { ...base.profile, units: answers.units ?? base.profile.units } };
    return { applied, first: generatePlanV2(applied, { style: answers.style ?? 'auto', customPairs: answers.customPairs, seed, shown: [] }, now) };
    // `data` changes on every store write; the plan only depends on what the user answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, seed, now, ready]);

  const result = history.at(-1) ?? built?.first;
  const lines = useMemo(() => {
    if (!built || !result) return [];
    const p = built.applied.profile;
    const e = energy(p, answers.weightKg, dayjs(now).year()).energy;
    const deficit = e && p.bodyGoal === 'lose' ? e.tdee - e.target : undefined;
    return explainV2(result, p, estimateBodyFat(p, answers.weightKg, dayjs(now).year()), deficit);
  }, [result, built, answers.weightKg, now]);
  if (!built || !result) return null;
  const { applied, first } = built;
  const broken = validateSplit(result.split) !== null;

  function regenerate() {
    const s = useOnboarding.getState();
    const shown = s.shown.length ? s.shown : [first.picks];
    const r = generatePlanV2(applied, { style: answers.style ?? 'auto', customPairs: answers.customPairs, seed, shown }, now);
    s.regenerated(r, shown);
  }

  const split = result.split;
  function finish(edit: boolean) {
    let activated = true;
    act((d) => {
      const base = applyAnswers(d, answers, now);
      const res = commitPlan({ ...base, profile: { ...base.profile, units: answers.units ?? base.profile.units } }, split, now);
      activated = res.activated;
      return res.data;
    });
    useOnboarding.getState().reset();
    if (!activated) toast('Saved to your splits. Switch to it after this workout');
    const saved = useApp.getState().data.customSplits.find((s) => s.id === split.id);
    if (edit && saved) {
      // The editor works on a draft; without one it closes straight away.
      useSplitDraft.getState().open(saved);
      openSheet(`split-edit:${saved.id}`, { replace: rerun });
    } else if (rerun) closeSheet();
  }

  if (broken) {
    return (
      <>
        <Empty title="We couldn't build a plan with this equipment" body="Add equipment or pick a split yourself." />
        <StepFooter>
          <Button
            size="lg"
            onClick={() => {
              act((d) => skipOnboarding(d, now));
              useOnboarding.getState().reset();
              openSheet('split', { replace: rerun });
            }}
          >
            Pick a split
          </Button>
        </StepFooter>
      </>
    );
  }

  return (
    <>
      <StepTitle title={result.split.name} subtitle={`${answers.daysPerWeek} days a week · ${answers.sessionMinutes} min`} />
      <div className="flex items-center gap-2 px-1 pb-4">
        <Button variant="tinted" size="sm" onClick={regenerate}>
          <RefreshCw className="mr-1 size-4" /> Regenerate
        </Button>
        <Button variant="plain" size="sm" disabled={history.length === 0} onClick={() => useOnboarding.getState().backPlan()}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
      </div>
      {result.exhausted && history.length > 0 && <p className="px-1 pb-4 text-footnote text-label-2">That's every different plan for these answers</p>}
      <List>
        {lines.map((l) => (
          <Row key={l} title={<span className="whitespace-normal">{l}</span>} />
        ))}
      </List>

      {result.split.sessions.map((s, i) => (
        <div key={i}>
          <SectionHeader title={`Day ${i + 1} · ${s.title}`} />
          <List>
            {s.slots.map((slot) => (
              <Row
                key={slot.id}
                title={getExercise(slot.candidates[0], data.customExercises)?.name ?? slot.candidates[0]}
                value={slot.role === 'anchor' ? 'Main' : undefined}
              />
            ))}
          </List>
        </div>
      ))}

      <SectionHeader title="Food" />
      <EnergyCard profile={applied.profile} kg={answers.weightKg} />

      <StepFooter>
        <Button size="lg" onClick={() => finish(false)}>
          Use this plan
        </Button>
        <Button variant="plain" onClick={() => finish(true)}>
          Edit days and exercises
        </Button>
      </StepFooter>
    </>
  );
}
