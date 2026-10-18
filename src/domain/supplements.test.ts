import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { normalize } from './migrate';
import { activeSupplements, addSupplement, renameSupplement, setSupplementArchived, suppStreak, toggleSupplement } from './supplements';

const NOW = '2026-10-17T08:00:00.000Z';
const stack = () => {
  let d = addSupplement({ ...emptyAppData(NOW), supplements: [] }, 'Creatine', '5 g');
  d = addSupplement(d, 'Whey', '1 scoop');
  return d;
};

describe('supplements', () => {
  it('adds with stable slug ids, renames and archives', () => {
    let d = stack();
    expect(d.supplements.map((s) => s.id)).toEqual(['creatine', 'whey']);
    d = addSupplement(d, 'creatine');
    expect(d.supplements.map((s) => s.id)).toEqual(['creatine', 'whey', 'creatine-2']);
    d = renameSupplement(d, 'whey', 'Whey isolate');
    expect(d.supplements[1]).toMatchObject({ id: 'whey', name: 'Whey isolate', dose: '1 scoop' });
    d = setSupplementArchived(d, 'creatine-2', true);
    expect(activeSupplements(d).map((s) => s.id)).toEqual(['creatine', 'whey']);
  });

  it('ignores blank names', () => {
    const d = emptyAppData(NOW);
    expect(addSupplement(d, '  ')).toBe(d);
  });

  it('one tap marks taken, a second tap undoes', () => {
    let d = toggleSupplement(stack(), '2026-10-17', 'creatine');
    expect(d.suppLog['2026-10-17']).toEqual(['creatine']);
    d = toggleSupplement(d, '2026-10-17', 'creatine');
    expect(d.suppLog['2026-10-17']).toEqual([]);
  });

  it('streak counts full days, and an unfinished today does not break it', () => {
    let d = stack();
    for (const day of ['2026-10-14', '2026-10-15', '2026-10-16']) {
      d = toggleSupplement(d, day, 'creatine');
      d = toggleSupplement(d, day, 'whey');
    }
    expect(suppStreak(d, '2026-10-17')).toBe(3);
    d = toggleSupplement(d, '2026-10-17', 'creatine');
    expect(suppStreak(d, '2026-10-17')).toBe(3);
    d = toggleSupplement(d, '2026-10-17', 'whey');
    expect(suppStreak(d, '2026-10-17')).toBe(4);
  });

  it('streak is 0 without any active supplements', () => {
    expect(suppStreak({ ...emptyAppData(NOW), supplements: [] }, '2026-10-17')).toBe(0);
  });

  it('older documents load with an empty stack and log', () => {
    const old = JSON.parse(JSON.stringify(emptyAppData(NOW))) as { supplements?: unknown; suppLog?: unknown };
    delete old.supplements;
    delete old.suppLog;
    const d = normalize(old, NOW)!;
    expect(d.supplements).toEqual([]);
    expect(d.suppLog).toEqual({});
  });
});
