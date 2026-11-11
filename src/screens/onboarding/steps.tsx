import { useState } from 'react';
import { ALL_EQUIPMENT } from '@/domain/catalogue';
import { bmiBand, suggestedGoal, type PlanGoal } from '@/domain/plan';
import { bmi, fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import type { Activity, EquipmentKind, FocusArea, Profile } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, Switch, TextInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { act } from '@/store/app';
import { useOnboarding } from '@/store/onboarding';
import { SignInCard } from '@/screens/profile/SignInCard';
import { skipOnboarding } from '@/domain/plan';
import { ChoiceList, FieldError, Label, NextButton, StepFooter, StepTitle, type Choice } from './parts';

const useDraft = () => useOnboarding((s) => s.answers);
const setDraft = (patch: Parameters<ReturnType<typeof useOnboarding.getState>['set']>[0]) => useOnboarding.getState().set(patch);
const next = () => useOnboarding.getState().next();

export function Welcome({ rerun }: { rerun: boolean }) {
  const [signIn, setSignIn] = useState(false);
  return (
    <>
      <div className="flex min-h-[60dvh] flex-col justify-end px-1 pb-6">
        <h1 className="text-largetitle font-bold">Let's build your plan</h1>
        <p className="mt-2 max-w-[34ch] text-body text-label-2">
          A few questions about you and your week. You get a split built around the muscles you care about, plus a calorie and protein estimate.
        </p>
      </div>
      {signIn && <SignInCard />}
      <StepFooter>
        <NextButton label="Build my plan" onClick={next} />
        {!rerun && (
          <>
            <Button variant="plain" onClick={() => act((d) => skipOnboarding(d, new Date().toISOString()))}>
              Skip, I'll pick a split
            </Button>
            {!signIn && (
              <Button variant="plain" size="sm" className="text-label-2" onClick={() => setSignIn(true)}>
                Have an account? Sign in
              </Button>
            )}
          </>
        )}
      </StepFooter>
    </>
  );
}

const inRange = (v: number | null, min: number, max: number) => v != null && v >= min && v <= max;

export function Body({ defaultUnits }: { defaultUnits: Profile['units'] }) {
  const a = useDraft();
  const units = a.units ?? defaultUnits;
  const [height, setHeight] = useState(a.heightCm ? String(a.heightCm) : '');
  const [weight, setWeight] = useState(a.weightKg ? String(toDisplay(a.weightKg, units)) : '');
  const [age, setAge] = useState(a.age ? String(a.age) : '');
  const [sex, setSex] = useState<'male' | 'female' | 'skip'>(a.sex ?? 'skip');
  const [tried, setTried] = useState(false);

  const cm = parseNumber(height);
  const shown = parseNumber(weight);
  const kg = shown == null ? null : +fromDisplay(shown, units).toFixed(2);
  const years = parseNumber(age);
  const errors = [
    !inRange(cm, 100, 250) && 'Height must be 100–250 cm.',
    !inRange(kg, 30, 300) && `Weight must be ${toDisplay(30, units)}–${toDisplay(300, units)} ${units}.`,
    age.trim() && !inRange(years, 13, 100) && 'Age must be 13–100, or leave it empty.',
  ].filter(Boolean) as string[];

  function submit() {
    setTried(true);
    if (errors.length) return;
    setDraft({ heightCm: cm!, weightKg: kg!, age: age.trim() ? Math.round(years!) : undefined, sex: sex === 'skip' ? undefined : sex, units });
    next();
  }

  return (
    <>
      <StepTitle title="About you" subtitle="Used for your calorie and protein estimate. Sex and age are optional." />
      <List>
        <FieldRow label="Height (cm)">
          <TextInput aria-label="Height in cm" inputMode="decimal" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} className="w-24" />
        </FieldRow>
        <FieldRow label={`Weight (${units})`}>
          <TextInput aria-label={`Weight in ${units}`} inputMode="decimal" placeholder={units === 'kg' ? '75' : '165'} value={weight} onChange={(e) => setWeight(e.target.value)} className="w-24" />
        </FieldRow>
        <FieldRow label="Age">
          <TextInput aria-label="Age" inputMode="numeric" placeholder="Optional" value={age} onChange={(e) => setAge(e.target.value)} className="w-24" />
        </FieldRow>
      </List>
      <div className="mt-6 space-y-5 px-1">
        <div>
          <Label>Units</Label>
          <Segmented
            value={units}
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
            onChange={(u) => {
              if (shown != null) setWeight(String(toDisplay(fromDisplay(shown, units), u)));
              setDraft({ units: u });
            }}
          />
        </div>
        <div>
          <Label>Sex</Label>
          <Segmented
            value={sex}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'skip', label: 'Skip' },
            ]}
            onChange={setSex}
          />
        </div>
      </div>
      {tried && <FieldError>{errors[0]}</FieldError>}
      <StepFooter>
        <NextButton onClick={submit} />
      </StepFooter>
    </>
  );
}

const GOALS: Choice<PlanGoal>[] = [
  { value: 'lose', label: 'Lose fat', hint: 'Keep your muscle while the scale goes down' },
  { value: 'build', label: 'Build muscle', hint: 'Grow, with a small calorie surplus' },
  { value: 'strength', label: 'Get stronger', hint: 'Heavier lifts, fewer reps' },
  { value: 'fit', label: 'Stay fit', hint: 'Balanced training, steady weight' },
];

export function Goal() {
  const a = useDraft();
  const value = a.heightCm && a.weightKg ? bmi(a.weightKg, a.heightCm) : null;
  const suggestion = value != null ? suggestedGoal(bmiBand(value)) : null;
  const goal = a.goal ?? suggestion ?? undefined;
  return (
    <>
      <StepTitle title="What do you want most?" />
      <ChoiceList options={GOALS} selected={goal ? [goal] : []} onToggle={(g) => setDraft({ goal: g })} />
      {suggestion && <p className="px-4 pt-2 text-footnote text-label-2">Suggested from your BMI. BMI can misread muscular builds, so pick what you want.</p>}
      <StepFooter>
        <NextButton
          disabled={!goal}
          onClick={() => {
            setDraft({ goal });
            next();
          }}
        />
      </StepFooter>
    </>
  );
}

const ACTIVITY: Choice<Activity>[] = [
  { value: 'sitting', label: 'Mostly sitting', hint: 'Desk job, driving, studying' },
  { value: 'feet', label: 'On my feet', hint: 'Teaching, retail, walking a lot' },
  { value: 'physical', label: 'Physical work', hint: 'Building, warehouse, farm' },
];

export function DailyLife() {
  const a = useDraft();
  return (
    <>
      <StepTitle title="What is a normal day like?" subtitle="Outside your workouts." />
      <ChoiceList options={ACTIVITY} selected={a.activity ? [a.activity] : []} onToggle={(activity) => setDraft({ activity })} />
      <StepFooter>
        <NextButton disabled={!a.activity} onClick={next} />
      </StepFooter>
    </>
  );
}

export function Calories() {
  const a = useDraft();
  const [text, setText] = useState(a.intakeKcal ? String(a.intakeKcal) : '');
  const [tried, setTried] = useState(false);
  const kcal = parseNumber(text);
  const ok = inRange(kcal, 800, 6000);
  return (
    <>
      <StepTitle title="About how many calories do you eat a day?" subtitle="A rough guess is fine. We compare it with what your body uses." />
      <List>
        <FieldRow label="Calories a day">
          <TextInput aria-label="Calories a day" inputMode="numeric" placeholder="2200" value={text} onChange={(e) => setText(e.target.value)} className="w-24" />
        </FieldRow>
      </List>
      {tried && !ok && <FieldError>Enter 800–6000, or tap Not sure.</FieldError>}
      <StepFooter>
        <NextButton
          disabled={!text.trim()}
          onClick={() => {
            setTried(true);
            if (!ok) return;
            setDraft({ intakeKcal: Math.round(kcal!) });
            next();
          }}
        />
        <Button
          variant="plain"
          onClick={() => {
            setDraft({ intakeKcal: undefined });
            next();
          }}
        >
          Not sure
        </Button>
      </StepFooter>
    </>
  );
}

const EXPERIENCE: Choice<Profile['experience']>[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Under 1 year of regular lifting' },
  { value: 'intermediate', label: 'Intermediate', hint: '1 to 3 years' },
  { value: 'advanced', label: 'Advanced', hint: '3 years or more' },
];

export function Experience() {
  const a = useDraft();
  return (
    <>
      <StepTitle title="How long have you been lifting?" />
      <ChoiceList options={EXPERIENCE} selected={a.experience ? [a.experience] : []} onToggle={(experience) => setDraft({ experience })} />
      <StepFooter>
        <NextButton disabled={!a.experience} onClick={next} />
      </StepFooter>
    </>
  );
}

const DAY_OPTIONS = ['2', '3', '4', '5', '6'] as const;
const MINUTE_OPTIONS = ['45', '60', '75', '90'] as const;

export function Schedule() {
  const a = useDraft();
  const days = String(a.daysPerWeek ?? 3) as (typeof DAY_OPTIONS)[number];
  const minutes = String(a.sessionMinutes ?? 60) as (typeof MINUTE_OPTIONS)[number];
  return (
    <>
      <StepTitle title="How often can you train?" subtitle="Pick what you can keep up, not your best week." />
      <div className="space-y-6 px-1">
        <div>
          <Label>Days a week</Label>
          <Segmented value={days} options={DAY_OPTIONS.map((d) => ({ value: d, label: d }))} onChange={(d) => setDraft({ daysPerWeek: Number(d) })} />
        </div>
        <div>
          <Label>Minutes a session</Label>
          <Segmented
            value={minutes}
            options={MINUTE_OPTIONS.map((m) => ({ value: m, label: `${m} min` }))}
            onChange={(m) => setDraft({ sessionMinutes: Number(m) as Profile['sessionMinutes'] })}
          />
        </div>
      </div>
      <StepFooter>
        <NextButton
          onClick={() => {
            setDraft({ daysPerWeek: Number(days), sessionMinutes: Number(minutes) as Profile['sessionMinutes'] });
            next();
          }}
        />
      </StepFooter>
    </>
  );
}

const EQUIPMENT_LABEL: Record<EquipmentKind, string> = {
  barbell: 'Barbells & racks',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cable stack',
  bodyweight: 'Pull-up bar & dip station',
};

export function Equipment({ fallback }: { fallback: EquipmentKind[] }) {
  const a = useDraft();
  const list = a.equipment ?? fallback;
  return (
    <>
      <StepTitle title="What can you use?" subtitle="Exercises only come from what you switch on." />
      <List>
        {ALL_EQUIPMENT.map((k) => (
          <FieldRow key={k} label={EQUIPMENT_LABEL[k]}>
            <Switch label={EQUIPMENT_LABEL[k]} checked={list.includes(k)} onChange={(on) => setDraft({ equipment: on ? [...list, k] : list.filter((x) => x !== k) })} />
          </FieldRow>
        ))}
      </List>
      {list.length === 0 && <FieldError>Switch on at least one.</FieldError>}
      <StepFooter>
        <NextButton
          disabled={list.length === 0}
          onClick={() => {
            setDraft({ equipment: list });
            next();
          }}
        />
      </StepFooter>
    </>
  );
}

const AREAS: { value: FocusArea; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'abs', label: 'Abs' },
];

export function Focus() {
  const a = useDraft();
  const focus = a.focus ?? [];
  const toggle = (f: FocusArea) => {
    if (focus.includes(f)) setDraft({ focus: focus.filter((x) => x !== f) });
    else if (focus.length < 3) setDraft({ focus: [...focus, f] });
  };
  return (
    <>
      <StepTitle title="Which muscles do you want to grow most?" subtitle="Pick up to 3. They get extra sets and go first in a session. Everything else still trains." />
      <div className="flex flex-wrap gap-2 px-1" role="group" aria-label="Focus muscles">
        {AREAS.map((o) => {
          const on = focus.includes(o.value);
          return (
            <Button key={o.value} variant={on ? 'primary' : 'gray'} aria-pressed={on} disabled={!on && focus.length >= 3} onClick={() => toggle(o.value)}>
              {o.label}
            </Button>
          );
        })}
        <Button variant={focus.length === 0 ? 'primary' : 'gray'} aria-pressed={focus.length === 0} onClick={() => setDraft({ focus: [] })}>
          No preference
        </Button>
      </div>
      <StepFooter>
        <NextButton
          label="See my plan"
          onClick={() => {
            setDraft({ focus });
            next();
          }}
        />
      </StepFooter>
    </>
  );
}
