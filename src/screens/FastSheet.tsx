import { useState } from 'react';
import { activeFast, elapsedHours, endFast, fastPhase, FAST_TARGETS, needsSafetyAck, startFast, type FastTarget } from '@/domain/fasting';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { nowIso } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { Done } from './profile/Done';

const SAFETY = [
  'Not for anyone pregnant or breastfeeding, diabetic or on glucose-lowering medication, under 18, or with a history of eating disorders.',
  'Stop if you feel dizzy, faint or unwell. Keep drinking water.',
  'Talk to a doctor before long fasts if you have a medical condition.',
];

export function endFastToast(hours: number, target: number) {
  toast(hours >= target ? `Fast complete. ${Math.floor(hours)}h.` : `Fast ended at ${Math.floor(hours)}h.`);
}

export function FastSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const fast = activeFast(data);
  const [target, setTarget] = useState<FastTarget>(16);
  const [ack, setAck] = useState(false);
  const needsAck = needsSafetyAck(data, target);

  function start() {
    act((d) => startFast(needsAck ? { ...d, profile: { ...d.profile, fastingSafetyAck: true } } : d, target, nowIso()));
    toast(`Fast started. ${target}h target`);
    onClose();
  }

  function end() {
    const h = fast ? elapsedHours(fast, nowIso()) : 0;
    act((d) => endFast(d, nowIso()));
    if (fast) endFastToast(h, fast.targetHours);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Fast" right={<Done onClose={onClose} />}>
      {fast ? (
        <>
          <p className="px-4 pb-1 text-title3 font-bold tabular">
            {Math.floor(elapsedHours(fast, nowIso()))}h of {fast.targetHours}h
          </p>
          <p className="px-4 pb-4 text-subhead text-label-2">{fastPhase(elapsedHours(fast, nowIso()))}</p>
          <Button variant="destructive" className="w-full" onClick={end}>
            End fast
          </Button>
        </>
      ) : (
        <>
          <List>
            <FieldRow label="Target">
              <Segmented
                className="w-44"
                value={String(target) as '16' | '24' | '36'}
                onChange={(v) => setTarget(Number(v) as FastTarget)}
                options={FAST_TARGETS.map((t) => ({ value: String(t) as '16' | '24' | '36', label: `${t}h` }))}
              />
            </FieldRow>
          </List>
          {needsAck && (
            <div className="mt-3 rounded-card bg-orange/12 p-4">
              <div className="text-headline font-semibold">Before a long fast</div>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-subhead">
                {SAFETY.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-subhead font-semibold">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-5 accent-[#FF9500]" />I understand
              </label>
            </div>
          )}
          <Button size="lg" className="mt-4" disabled={needsAck && !ack} onClick={start}>
            Start fast
          </Button>
          <p className="px-4 pt-2 text-footnote text-label-2">Phases are general guidance, not medical advice.</p>
        </>
      )}
    </Sheet>
  );
}
