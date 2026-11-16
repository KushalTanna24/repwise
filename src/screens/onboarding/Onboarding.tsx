import { useLayoutEffect } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { goalFromProfile } from '@/domain/plan';
import { latestWeight } from '@/domain/stats';
import type { AppData } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { useData } from '@/store/app';
import { LAST_STEP, useOnboarding, type Draft } from '@/store/onboarding';
import { Result } from './Result';
import { Body, Calories, DailyLife, Equipment, Experience, Focus, Goal, Schedule, Welcome } from './steps';

/** A rerun starts from what the profile already knows. */
function prefill(data: AppData): Draft {
  const p = data.profile;
  return {
    heightCm: p.heightCm,
    weightKg: latestWeight(data)?.kg,
    sex: p.sex,
    age: p.birthYear ? dayjs().year() - p.birthYear : undefined,
    goal: goalFromProfile(p),
    activity: p.activity,
    intakeKcal: p.intakeKcal,
    experience: p.experience,
    daysPerWeek: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    equipment: p.equipment,
    focus: p.focus ?? [],
    units: p.units,
  };
}

/**
 * Full-screen question flow. On first launch it replaces the app until finished or
 * skipped; from Profile ("Build my plan") it opens over the app as a rerun.
 */
export function Onboarding({ rerun = false, onClose }: { rerun?: boolean; onClose?: () => void }) {
  const data = useData();
  const step = useOnboarding((s) => s.step);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const p = data.profile;
    useOnboarding.getState().start(rerun ? prefill(data) : { daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes, equipment: p.equipment, units: p.units }, rerun ? 1 : 0);
    return () => useOnboarding.getState().reset();
    // Seed once per open; later store writes must not reset the answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerun]);

  const first = rerun ? 1 : 0;
  const back = () => (step <= first ? onClose?.() : useOnboarding.getState().back());

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" data-onboarding>
      <div className="mx-auto max-w-[640px] px-4 pb-[calc(160px+env(safe-area-inset-bottom))]">
        <div className="pt-safe sticky top-0 z-10 bg-bg">
          <div className="flex h-11 items-center gap-3">
            {step > first || (rerun && onClose) ? (
              <Button variant="plain" size="icon" aria-label={step > first ? 'Back' : 'Close'} onClick={back}>
                <ChevronLeft className="size-6" strokeWidth={2.5} />
              </Button>
            ) : (
              <div className="size-9" />
            )}
            {step > 0 && (
              <div
                className="h-1 flex-1 overflow-hidden rounded-full bg-fill"
                role="progressbar"
                aria-label="Progress"
                aria-valuemin={1}
                aria-valuemax={LAST_STEP}
                aria-valuenow={step}
              >
                <motion.div className="h-full rounded-full bg-blue" initial={false} animate={{ width: `${(step / LAST_STEP) * 100}%` }} transition={{ duration: reduce ? 0 : 0.3 }} />
              </div>
            )}
            <div className="size-9" />
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && <Welcome rerun={rerun} />}
            {step === 1 && <Body defaultUnits={data.profile.units} />}
            {step === 2 && <Goal />}
            {step === 3 && <DailyLife />}
            {step === 4 && <Calories />}
            {step === 5 && <Experience />}
            {step === 6 && <Schedule />}
            {step === 7 && <Equipment fallback={data.profile.equipment} />}
            {step === 8 && <Focus />}
            {step === 9 && <Result rerun={rerun} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
