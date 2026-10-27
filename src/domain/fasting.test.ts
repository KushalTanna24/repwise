import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { endFast, fastPhase, fastReached, fastsEndedOn, needsSafetyAck, startFast } from './fasting';

const NOW = '2026-10-20T20:00:00';
const hoursLater = (h: number) => new Date(Date.parse(NOW) + h * 3_600_000).toISOString();

describe('fasting', () => {
  it('phases switch at 4, 12, 18 and 24 hours and stay on the last one', () => {
    expect([0, 3.9, 4, 11.9, 12, 18, 24, 80].map(fastPhase)).toEqual([
      'Digesting', 'Digesting', 'Blood sugar settling', 'Blood sugar settling', 'Fat burning', 'Ketosis', 'Autophagy ramping up', 'Autophagy ramping up',
    ]);
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

  it('long fasts need the safety note acknowledged once', () => {
    const d = emptyAppData(NOW);
    expect([needsSafetyAck(d, 16), needsSafetyAck(d, 24), needsSafetyAck(d, 36)]).toEqual([false, true, true]);
    expect(needsSafetyAck({ ...d, profile: { ...d.profile, fastingSafetyAck: true } }, 36)).toBe(false);
  });
});
