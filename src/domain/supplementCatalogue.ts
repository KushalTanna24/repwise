import type { AppData, SuppTiming } from './types';

export type { SuppTiming };

export const TIMING_ORDER: SuppTiming[] = ['morning', 'pre', 'post', 'meal', 'night', 'any'];

export const TIMING_LABEL: Record<SuppTiming, string> = {
  morning: 'Morning',
  pre: 'Pre-workout',
  post: 'Post-workout',
  meal: 'With a meal',
  night: 'Night',
  any: 'Any time',
};

export interface CatalogueSupplement {
  /** Stable slug, same id space as Supplement.id. */
  id: string;
  name: string;
  /** Typical single dose. */
  dose: string;
  timing: SuppTiming;
  /** One factual line: usual dose range and when people take it. */
  note: string;
}

export const SUPPLEMENT_CATALOGUE: CatalogueSupplement[] = [
  { id: 'creatine', name: 'Creatine', dose: '5 g', timing: 'any', note: 'Usually 3 to 5 g a day, taken at whatever time is easiest to repeat.' },
  { id: 'whey-protein', name: 'Whey protein', dose: '1 scoop', timing: 'post', note: 'Usually 20 to 40 g a serving, often after training or between meals.' },
  { id: 'casein', name: 'Casein protein', dose: '1 scoop', timing: 'night', note: 'Usually 20 to 40 g a serving, often taken before bed.' },
  { id: 'multivitamin', name: 'Multivitamin', dose: '1 tablet', timing: 'meal', note: 'Usually one tablet a day, taken with a meal.' },
  { id: 'vitamin-d3', name: 'Vitamin D3', dose: '1000 IU', timing: 'meal', note: 'Usually 600 to 2000 IU a day, taken with a meal that contains fat.' },
  { id: 'vitamin-b12', name: 'Vitamin B12', dose: '250 mcg', timing: 'morning', note: 'Usually 25 to 1000 mcg a day, often taken in the morning.' },
  { id: 'omega-3', name: 'Omega-3 fish oil', dose: '1 g', timing: 'meal', note: 'Usually 1 to 3 g of fish oil a day, taken with a meal.' },
  { id: 'magnesium', name: 'Magnesium', dose: '200 mg', timing: 'night', note: 'Usually 200 to 400 mg a day, often taken in the evening.' },
  { id: 'zinc', name: 'Zinc', dose: '15 mg', timing: 'meal', note: 'Usually 8 to 30 mg a day, taken with a meal.' },
  { id: 'iron', name: 'Iron', dose: '18 mg', timing: 'morning', note: 'Dose varies widely; people often take it in the morning, apart from calcium and coffee.' },
  { id: 'calcium', name: 'Calcium', dose: '500 mg', timing: 'meal', note: 'Usually 500 to 1000 mg a day, split into doses of 500 mg or less with meals.' },
  { id: 'electrolytes', name: 'Electrolytes', dose: '1 serving', timing: 'any', note: 'Usually one serving mixed in water, taken during or after long or hot sessions.' },
  { id: 'caffeine', name: 'Caffeine / pre-workout', dose: '200 mg', timing: 'pre', note: 'Usually 100 to 400 mg, taken 30 to 60 minutes before training.' },
  { id: 'beta-alanine', name: 'Beta-alanine', dose: '3.2 g', timing: 'pre', note: 'Usually 3 to 6 g a day, often split into smaller doses or taken before training.' },
  { id: 'citrulline', name: 'Citrulline', dose: '6 g', timing: 'pre', note: 'Usually 6 to 8 g of L-citrulline, taken 30 to 60 minutes before training.' },
  { id: 'ashwagandha', name: 'Ashwagandha', dose: '600 mg', timing: 'night', note: 'Usually 300 to 600 mg of extract a day, often taken in the evening.' },
  { id: 'melatonin', name: 'Melatonin', dose: '1 mg', timing: 'night', note: 'Usually 0.5 to 3 mg, taken 30 to 60 minutes before bed.' },
  { id: 'collagen', name: 'Collagen', dose: '10 g', timing: 'any', note: 'Usually 5 to 15 g a day, often mixed into a drink at any time.' },
  { id: 'glucosamine', name: 'Glucosamine', dose: '1500 mg', timing: 'meal', note: 'Usually 1500 mg a day, taken with a meal.' },
  { id: 'probiotic', name: 'Probiotic', dose: '1 capsule', timing: 'morning', note: 'Usually one capsule a day, often taken in the morning before or with breakfast.' },
];

export const DEFAULT_STACK_IDS = ['creatine', 'whey-protein', 'multivitamin'];

const entry = (c: CatalogueSupplement) => ({ id: c.id, name: c.name, dose: c.dose, timing: c.timing });

/** Seeds the default stack once. updatedAt stays put so a fresh device never beats the cloud copy in a sync. */
export function seedStack(data: AppData): AppData {
  if (data.meta.suppSeeded) return data;
  const supplements =
    data.supplements.length === 0
      ? DEFAULT_STACK_IDS.map((id) => entry(SUPPLEMENT_CATALOGUE.find((c) => c.id === id)!))
      : data.supplements;
  return { ...data, supplements, meta: { ...data.meta, suppSeeded: true } };
}

/** Copies a catalogue entry into the stack. An existing (archived) one is unarchived, not duplicated. */
export function addFromCatalogue(data: AppData, id: string): AppData {
  const found = SUPPLEMENT_CATALOGUE.find((c) => c.id === id);
  if (!found) return data;
  if (data.supplements.some((s) => s.id === id)) {
    return { ...data, supplements: data.supplements.map((s) => (s.id === id ? { ...s, archived: false } : s)) };
  }
  return { ...data, supplements: [...data.supplements, entry(found)] };
}
