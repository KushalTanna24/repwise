import { useMemo, useState } from 'react';
import { getExercise } from '@/domain/catalogue';
import { TEMPLATES, alternativesFor, applyAnswers, commitPlan, explain, generatePlan, skipOnboarding, templateFor, type PlanAnswers } from '@/domain/plan';
import { bmi } from '@/domain/stats';
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
  const chosen = useOnboarding((s) => s.template);
  const [now] = useState(() => new Date().toISOString());
  const template = chosen ?? templateFor(answers.daysPerWeek);

  // Built once per answer set so the split shown is the split saved.
  const { applied, result, lines } = useMemo(() => {
    const base = applyAnswers(data, answers, now);
    const applied = { ...base, profile: { ...base.profile, units: answers.units ?? base.profile.units } };
    const result = generatePlan(applied, template, now);
    return { applied, result, lines: explain(result, applied.profile, bmi(answers.weightKg, answers.heightCm)) };
    // `data` changes on every store write; the plan only depends on what the user answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, template, now]);

  const others = [templateFor(answers.daysPerWeek), ...alternativesFor(answers.daysPerWeek)].filter((t) => t !== template);
  const broken = validateSplit(result.split) !== null;

  function finish(edit: boolean) {
    let activated = true;
    act((d) => {
      const base = applyAnswers(d, answers, now);
      const res = commitPlan({ ...base, profile: { ...base.profile, units: answers.units ?? base.profile.units } }, result.split, now);
      activated = res.activated;
      return res.data;
    });
    useOnboarding.getState().reset();
    if (!activated) toast('Saved. Applies after this workout');
    const saved = useApp.getState().data.customSplits.find((s) => s.id === result.split.id);
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
      <StepTitle title={result.split.name} subtitle={`${result.split.sessions.length} days a week · ${answers.sessionMinutes} min`} />
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

      {others.length > 0 && (
        <>
          <SectionHeader title="Other options" />
          <List>
            {others.map((t) => (
              <Row key={t} title={TEMPLATES[t].name} subtitle={TEMPLATES[t].days.map((d) => d.title).join(' / ')} chevron onClick={() => useOnboarding.getState().setTemplate(t)} />
            ))}
          </List>
        </>
      )}

      <SectionHeader title="Food" />
      <EnergyCard profile={applied.profile} kg={answers.weightKg} />

      <StepFooter>
        <Button size="lg" onClick={() => finish(false)}>
          Start with this
        </Button>
        <Button variant="plain" onClick={() => finish(true)}>
          Edit days and exercises
        </Button>
      </StepFooter>
    </>
  );
}
