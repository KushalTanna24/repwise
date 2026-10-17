import type { Slot, SplitDef, SplitId } from './types';

const anchor = (id: string, pattern: Slot['pattern'], candidates: string[]): Slot => ({ id, pattern, role: 'anchor', candidates });
const acc = (id: string, pattern: Slot['pattern'], candidates: string[]): Slot => ({ id, pattern, role: 'accessory', candidates });

/**
 * Anchors stay the same every cycle so their progress is comparable.
 * Accessories rotate through their candidates by cycle number.
 * Slot order is the order exercises appear; accessories at the end get trimmed first.
 */
export const SPLITS: Record<SplitId, SplitDef> = {
  'full-body-abc': {
    id: 'full-body-abc',
    name: 'Full Body',
    blurb: '3 days · A / B / C',
    sessions: [
      {
        title: 'Full Body A',
        slots: [
          anchor('a-knee', 'knee', ['back-squat', 'hack-squat', 'leg-press', 'goblet-squat']),
          anchor('a-hpush', 'hpush', ['bench-press', 'db-bench-press', 'machine-chest-press', 'push-up']),
          anchor('a-hpull', 'hpull', ['chest-supported-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          acc('a-hip', 'hip', ['leg-curl', 'db-romanian-deadlift', 'back-extension']),
          acc('a-shoulders', 'shoulders', ['db-lateral-raise', 'cable-lateral-raise']),
          acc('a-core', 'core', ['plank', 'dead-bug']),
        ],
      },
      {
        title: 'Full Body B',
        slots: [
          anchor('b-hip', 'hip', ['romanian-deadlift', 'db-romanian-deadlift', 'back-extension']),
          anchor('b-vpush', 'vpush', ['overhead-press', 'seated-db-press', 'machine-shoulder-press']),
          anchor('b-vpull', 'vpull', ['lat-pulldown', 'pull-up', 'chin-up']),
          acc('b-knee', 'knee', ['bulgarian-split-squat', 'reverse-lunge', 'leg-extension']),
          acc('b-hpull', 'hpull', ['seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          acc('b-arms', 'arms', ['db-curl', 'cable-curl', 'hammer-curl']),
          acc('b-calves', 'calves', ['standing-calf-raise', 'seated-calf-raise']),
        ],
      },
      {
        title: 'Full Body C',
        slots: [
          anchor('c-knee', 'knee', ['leg-press', 'hack-squat', 'goblet-squat']),
          anchor('c-hpush', 'hpush', ['incline-db-press', 'db-bench-press', 'push-up']),
          anchor('c-vpull', 'vpull', ['pull-up', 'chin-up', 'lat-pulldown']),
          acc('c-hip', 'hip', ['hip-thrust', 'cable-pull-through', 'back-extension']),
          acc('c-shoulders', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
          acc('c-arms', 'arms', ['triceps-pushdown', 'overhead-triceps-extension', 'dip']),
          acc('c-core', 'core', ['hanging-knee-raise', 'cable-crunch', 'dead-bug']),
        ],
      },
    ],
  },
  'upper-lower': {
    id: 'upper-lower',
    name: 'Upper / Lower',
    blurb: '4 days · Upper / Lower',
    sessions: [
      {
        title: 'Upper',
        slots: [
          anchor('u-hpush', 'hpush', ['bench-press', 'db-bench-press', 'machine-chest-press', 'push-up']),
          anchor('u-vpull', 'vpull', ['lat-pulldown', 'pull-up', 'chin-up']),
          anchor('u-hpull', 'hpull', ['chest-supported-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          acc('u-vpush', 'vpush', ['seated-db-press', 'machine-shoulder-press', 'overhead-press']),
          acc('u-shoulders', 'shoulders', ['db-lateral-raise', 'cable-lateral-raise']),
          acc('u-biceps', 'arms', ['db-curl', 'cable-curl', 'hammer-curl']),
          acc('u-triceps', 'arms', ['triceps-pushdown', 'overhead-triceps-extension']),
        ],
      },
      {
        title: 'Lower',
        slots: [
          anchor('l-knee', 'knee', ['back-squat', 'hack-squat', 'leg-press', 'goblet-squat']),
          anchor('l-hip', 'hip', ['romanian-deadlift', 'db-romanian-deadlift', 'back-extension']),
          acc('l-knee2', 'knee', ['leg-press', 'bulgarian-split-squat', 'reverse-lunge']),
          acc('l-hip2', 'hip', ['leg-curl', 'hip-thrust']),
          acc('l-calves', 'calves', ['standing-calf-raise', 'seated-calf-raise']),
          acc('l-core', 'core', ['hanging-knee-raise', 'plank', 'cable-crunch']),
        ],
      },
    ],
  },
  ppl: {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    blurb: '3–6 days · Push / Pull / Legs',
    sessions: [
      {
        title: 'Push',
        slots: [
          anchor('p-hpush', 'hpush', ['bench-press', 'db-bench-press', 'machine-chest-press', 'push-up']),
          anchor('p-vpush', 'vpush', ['overhead-press', 'seated-db-press', 'machine-shoulder-press']),
          acc('p-incline', 'hpush', ['incline-db-press', 'machine-chest-press', 'dip']),
          acc('p-shoulders', 'shoulders', ['db-lateral-raise', 'cable-lateral-raise']),
          acc('p-triceps', 'arms', ['triceps-pushdown', 'overhead-triceps-extension']),
          acc('p-fly', 'hpush', ['cable-fly', 'push-up']),
        ],
      },
      {
        title: 'Pull',
        slots: [
          anchor('q-vpull', 'vpull', ['pull-up', 'lat-pulldown', 'chin-up']),
          anchor('q-hpull', 'hpull', ['barbell-row', 'chest-supported-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          acc('q-rear', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
          acc('q-biceps', 'arms', ['db-curl', 'cable-curl']),
          acc('q-hammer', 'arms', ['hammer-curl', 'cable-curl']),
          acc('q-lats', 'vpull', ['straight-arm-pulldown', 'lat-pulldown']),
        ],
      },
      {
        title: 'Legs',
        slots: [
          anchor('g-knee', 'knee', ['back-squat', 'hack-squat', 'leg-press', 'goblet-squat']),
          anchor('g-hip', 'hip', ['romanian-deadlift', 'db-romanian-deadlift', 'back-extension']),
          acc('g-knee2', 'knee', ['leg-press', 'bulgarian-split-squat', 'leg-extension']),
          acc('g-hip2', 'hip', ['leg-curl', 'hip-thrust']),
          acc('g-calves', 'calves', ['standing-calf-raise', 'seated-calf-raise']),
          acc('g-core', 'core', ['hanging-knee-raise', 'plank', 'cable-crunch']),
        ],
      },
    ],
  },
};
