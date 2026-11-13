import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { normalize } from './migrate';
import { DEFAULT_STACK_IDS, SUPPLEMENT_CATALOGUE, TIMING_LABEL, TIMING_ORDER, addFromCatalogue, seedStack } from './supplementCatalogue';
import { addSupplement, setSupplementArchived, updateSupplement } from './supplements';

const NOW = '2026-10-18T08:00:00.000Z';
const bare = () => ({ ...emptyAppData(NOW), supplements: [] });
const v4Doc = (patch: Record<string, unknown>, meta: Record<string, unknown> = {}) => ({
  ...emptyAppData(NOW),
  ...patch,
  meta: { updatedAt: '2026-10-10T00:00:00.000Z', ...meta },
});

describe('supplement catalogue', () => {
  it('has 20 unique slug-shaped entries with a dose and a note', () => {
    expect(SUPPLEMENT_CATALOGUE).toHaveLength(20);
    const ids = SUPPLEMENT_CATALOGUE.map((s) => s.id);
    expect(new Set(ids).size).toBe(20);
    for (const s of SUPPLEMENT_CATALOGUE) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.dose.length).toBeGreaterThan(0);
      expect(s.note.length).toBeGreaterThan(0);
      expect(TIMING_ORDER).toContain(s.timing);
    }
  });

  it('labels every timing in order', () => {
    expect(TIMING_ORDER.map((t) => TIMING_LABEL[t])).toEqual(['Morning', 'Pre-workout', 'Post-workout', 'With a meal', 'Night', 'Any time']);
  });

  it('default stack entries carry the agreed doses and timings', () => {
    expect(DEFAULT_STACK_IDS).toEqual(['creatine', 'whey-protein', 'multivitamin']);
    const by = (id: string) => SUPPLEMENT_CATALOGUE.find((s) => s.id === id)!;
    expect(by('creatine')).toMatchObject({ dose: '5 g', timing: 'any' });
    expect(by('whey-protein')).toMatchObject({ dose: '1 scoop', timing: 'post' });
    expect(by('multivitamin')).toMatchObject({ dose: '1 tablet', timing: 'meal' });
  });
});

describe('seeded stack', () => {
  it('new data starts with the default stack and the flag', () => {
    const d = emptyAppData(NOW);
    expect(d.supplements.map((s) => s.id)).toEqual(['creatine', 'whey-protein', 'multivitamin']);
    expect(d.meta.suppSeeded).toBe(true);
  });

  it('normalize seeds an empty unflagged stack without touching updatedAt', () => {
    const d = normalize(v4Doc({ supplements: [] }), NOW)!;
    expect(d.supplements.map((s) => s.id)).toEqual(['creatine', 'whey-protein', 'multivitamin']);
    expect(d.meta.updatedAt).toBe('2026-10-10T00:00:00.000Z');
    expect(d.meta.suppSeeded).toBe(true);
  });

  it('normalize keeps an existing stack and only sets the flag', () => {
    const d = normalize(v4Doc({ supplements: [{ id: 'fish', name: 'Fish oil', archived: true }] }), NOW)!;
    expect(d.supplements).toEqual([{ id: 'fish', name: 'Fish oil', archived: true }]);
    expect(d.meta.suppSeeded).toBe(true);
  });

  it('normalize keeps a flagged empty stack empty', () => {
    const d = normalize(v4Doc({ supplements: [] }, { suppSeeded: true }), NOW)!;
    expect(d.supplements).toEqual([]);
  });

  it('seedStack is a no-op on seeded data', () => {
    const d = emptyAppData(NOW);
    expect(seedStack(d)).toEqual(d);
  });
});

describe('addFromCatalogue', () => {
  it('copies id, name, dose and timing, and does not duplicate', () => {
    let d = addFromCatalogue(bare(), 'zinc');
    const zinc = SUPPLEMENT_CATALOGUE.find((s) => s.id === 'zinc')!;
    expect(d.supplements).toEqual([{ id: 'zinc', name: zinc.name, dose: zinc.dose, timing: zinc.timing }]);
    d = addFromCatalogue(d, 'zinc');
    expect(d.supplements).toHaveLength(1);
  });

  it('unarchives an archived entry', () => {
    let d = addFromCatalogue(bare(), 'zinc');
    d = setSupplementArchived(d, 'zinc', true);
    d = addFromCatalogue(d, 'zinc');
    expect(d.supplements).toHaveLength(1);
    expect(d.supplements[0].archived).toBe(false);
  });

  it('returns the same data for an unknown id', () => {
    const d = bare();
    expect(addFromCatalogue(d, 'nope')).toBe(d);
  });
});

describe('custom supplements and edits', () => {
  it('custom supplements default to any time', () => {
    expect(addSupplement(bare(), 'Rice').supplements[0].timing).toBe('any');
  });

  it('updateSupplement patches name, dose and timing', () => {
    const d = updateSupplement(emptyAppData(NOW), 'creatine', { dose: '3 g', timing: 'morning', name: ' Creatine mono ' });
    expect(d.supplements[0]).toMatchObject({ id: 'creatine', name: 'Creatine mono', dose: '3 g', timing: 'morning' });
  });

  it('updateSupplement ignores a blank name', () => {
    const d = updateSupplement(emptyAppData(NOW), 'creatine', { name: '  ', dose: '4 g' });
    expect(d.supplements[0]).toMatchObject({ name: 'Creatine', dose: '4 g' });
  });
});
