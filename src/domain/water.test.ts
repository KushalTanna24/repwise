import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { normalize } from './migrate';
import { addWater, waterWeek, GLASS_ML } from './water';

const NOW = '2026-10-17T08:00:00.000Z';

describe('water', () => {
  it('one tap adds one glass for that day', () => {
    let d = addWater(emptyAppData(NOW), '2026-10-17', 1);
    d = addWater(d, '2026-10-17', 1);
    expect(d.water['2026-10-17']).toBe(2);
  });

  it('undo never goes below zero', () => {
    const d = addWater(addWater(emptyAppData(NOW), '2026-10-17', 1), '2026-10-17', -1);
    expect(d.water['2026-10-17']).toBe(0);
    expect(addWater(d, '2026-10-17', -1).water['2026-10-17']).toBe(0);
  });

  it('defaults to an 8-glass goal of 250 ml glasses', () => {
    expect(emptyAppData(NOW).profile.waterGoal).toBe(8);
    expect(GLASS_ML).toBe(250);
  });

  it('week summary counts the last 7 days ending today', () => {
    let d = emptyAppData(NOW);
    d = addWater(d, '2026-10-17', 1);
    d = addWater(d, '2026-10-17', 1);
    d = addWater(d, '2026-10-12', 1);
    d = addWater(d, '2026-10-01', 1);
    const w = waterWeek(d, '2026-10-17');
    expect(w.days.map((x) => x.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
    expect(w.days.map((x) => x.glasses)).toEqual([0, 1, 0, 0, 0, 0, 2]);
    expect(w.avg).toBe(0.4);
    expect(w.daysHit).toBe(0);
  });

  it('older saved documents without water load with an empty log and default goal', () => {
    const old = JSON.parse(JSON.stringify(emptyAppData(NOW))) as { water?: unknown; profile: { waterGoal?: number } };
    delete old.water;
    delete old.profile.waterGoal;
    const d = normalize(old, NOW)!;
    expect(d.water).toEqual({});
    expect(d.profile.waterGoal).toBe(8);
  });
});
