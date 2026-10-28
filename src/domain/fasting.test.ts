import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { elapsedHours, endFast, fastEndsAt, fastPhase, fastReached, fastsEndedOn, fmtFastEnd, needsSafetyAck, startFast, validFastHours } from './fasting';

const NOW = '2026-10-20T20:00:00';
const hoursLater = (h: number) => new Date(Date.parse(NOW) + h * 3_600_000).toISOString();

describe('fasting', () => {
  it('phases switch at 4, 12, 18 and 24 hours and stay on the last one', () => {
    expect([0, 3.9, 4, 11.9, 12, 18, 24, 80].map(fastPhase)).toEqual([
      'Digesting', 'Digesting', 'Blood sugar settling', 'Blood sugar settling', 'Fat burning', 'Ketosis', 'Autophagy ramping up', 'Autophagy ramping up',
    ]);
  });

  it('a clock slightly behind the start reads as zero, never a crash', () => {
    const d = startFast(emptyAppData(NOW), 16, NOW, 'f1');
    const early = new Date(Date.parse(NOW) - 30_000).toISOString();
    expect(elapsedHours(d.fasts[0], early)).toBe(0);
    expect(fastPhase(-0.01)).toBe('Digesting');
  });

  it('one fast at a time', () => {
    const d = startFast(emptyAppData(NOW), 16, NOW, 'f1');
    expect(d.fasts).toHaveLength(1);
    expect(startFast(d, 24, NOW, 'f2')).toBe(d);
  });

  it('a fast counts as reached only when it ran to its target', () => {
    const d = startFast(emptyAppData(NOW), 16, NOW, 'f1');
    expect(fastReached(endFast(d, hoursLater(15)).fasts[0])).toBe(false);
    expect(fastReached(endFast(d, hoursLater(16)).fasts[0])).toBe(true);
    expect(fastReached(d.fasts[0])).toBe(false);
  });

  it('belongs to the local date it ended on', () => {
    const d = endFast(startFast(emptyAppData(NOW), 16, NOW, 'f1'), '2026-10-21T12:00:00');
    expect(fastsEndedOn(d, '2026-10-21').map((f) => f.id)).toEqual(['f1']);
    expect(fastsEndedOn(d, '2026-10-20')).toEqual([]);
  });

  it('any whole number of hours from 1 to 72 is a valid target', () => {
    expect([0, 1, 13, 72, 73, 12.5, NaN].map(validFastHours)).toEqual([false, true, true, true, false, false, false]);
    expect(startFast(emptyAppData(NOW), 13, NOW, 'f1').fasts[0].targetHours).toBe(13);
    const d = emptyAppData(NOW);
    expect(startFast(d, 0, NOW, 'f1')).toBe(d);
  });

  it('ends at its start plus the target, said relative to now', () => {
    const f = startFast(emptyAppData(NOW), 16, NOW, 'f1').fasts[0];
    expect(fastEndsAt(f)).toBe(hoursLater(16));
    expect(fmtFastEnd(f, NOW)).toBe('Ends tomorrow 12:00');
    expect(fmtFastEnd(startFast(emptyAppData(NOW), 2, NOW, 'f2').fasts[0], NOW)).toBe('Ends today 22:00');
    expect(fmtFastEnd(startFast(emptyAppData(NOW), 40, NOW, 'f3').fasts[0], NOW)).toBe('Ends Thu 12:00');
    expect(fmtFastEnd(f, hoursLater(17))).toBe('Target reached 12:00');
  });

  it('long fasts need the safety note acknowledged once', () => {
    const d = emptyAppData(NOW);
    expect([needsSafetyAck(d, 16), needsSafetyAck(d, 24), needsSafetyAck(d, 36)]).toEqual([false, true, true]);
    expect(needsSafetyAck({ ...d, profile: { ...d.profile, fastingSafetyAck: true } }, 36)).toBe(false);
  });
});
