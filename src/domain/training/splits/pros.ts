import type { ProSplitId, Slot } from '../types';

export type ProCategory = 'bodybuilder' | 'hollywood' | 'athlete';

export const PRO_CATEGORY_LABEL: Record<ProCategory, string> = {
  bodybuilder: 'Bodybuilders',
  hollywood: 'Hollywood',
  athlete: 'Athletes',
};

export interface ProSession {
  title: string;
  short?: string;
  slots: Slot[];
  /** Slot ids done back to back. Shown in the detail view; logged as supersets in a later release. */
  supersets?: [string, string][];
}

/**
 * A routine a well-known lifter trained or described, rebuilt from the
 * Repwise catalogue. Read-only: people copy it into a custom split to train it.
 */
export interface ProSplit {
  id: ProSplitId;
  person: string;
  /** What they are known for, e.g. "7× Mr. Olympia". */
  title: string;
  category: ProCategory;
  era: string;
  /** The name a copy gets in the user's splits. */
  name: string;
  tagline: string;
  /** Sessions a week they ran it. */
  daysPerWeek: number;
  schedule: string;
  techniques: string[];
  /** Where the routine comes from, and how sure we are. */
  source: string;
  /** Reports disagree; this is a close reading, not their exact program. */
  inspired?: true;
  sessions: ProSession[];
}

const main = (id: string, pattern: Slot['pattern'], candidates: string[]): Slot => ({ id, pattern, role: 'anchor', candidates });
const extra = (id: string, pattern: Slot['pattern'], candidates: string[]): Slot => ({ id, pattern, role: 'accessory', candidates });

// Shared candidate lists. The first entry is what the lifter used, or the closest catalogue match;
// the rest are stand-ins for other equipment, in the order Repwise should try them.
const BENCH = ['bench-press', 'db-bench-press', 'machine-chest-press', 'push-up'];
const INCLINE = ['incline-db-press', 'db-bench-press', 'machine-chest-press', 'push-up'];
const FLY = ['cable-fly', 'push-up'];
const DIP = ['dip', 'triceps-pushdown', 'push-up'];
const PRESS = ['overhead-press', 'seated-db-press', 'machine-shoulder-press', 'pike-push-up'];
const DB_PRESS = ['seated-db-press', 'machine-shoulder-press', 'overhead-press', 'pike-push-up'];
const LATERAL = ['db-lateral-raise', 'cable-lateral-raise'];
const REAR = ['rear-delt-fly', 'reverse-pec-deck', 'face-pull'];
const PULLUP = ['pull-up', 'lat-pulldown', 'chin-up'];
const PULLDOWN = ['lat-pulldown', 'pull-up', 'chin-up'];
const ROW = ['barbell-row', 'chest-supported-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row'];
const DB_ROW = ['one-arm-db-row', 'seated-cable-row', 'chest-supported-row', 'inverted-row'];
const CABLE_ROW = ['seated-cable-row', 'chest-supported-row', 'one-arm-db-row', 'inverted-row'];
const PULLOVER = ['straight-arm-pulldown', 'lat-pulldown', 'pull-up'];
const CURL = ['db-curl', 'cable-curl', 'hammer-curl'];
const CABLE_CURL = ['cable-curl', 'db-curl', 'hammer-curl'];
const HAMMER = ['hammer-curl', 'db-curl', 'cable-curl'];
const PUSHDOWN = ['triceps-pushdown', 'overhead-triceps-extension', 'dip'];
const OVERHEAD_EXT = ['overhead-triceps-extension', 'triceps-pushdown', 'dip'];
const SQUAT = ['back-squat', 'hack-squat', 'leg-press', 'goblet-squat'];
const HACK = ['hack-squat', 'leg-press', 'back-squat', 'goblet-squat'];
const LEG_PRESS = ['leg-press', 'hack-squat', 'goblet-squat', 'bulgarian-split-squat'];
const LEG_EXT = ['leg-extension', 'bulgarian-split-squat', 'goblet-squat'];
const LUNGE = ['reverse-lunge', 'bulgarian-split-squat', 'goblet-squat'];
const SPLIT_SQUAT = ['bulgarian-split-squat', 'reverse-lunge', 'goblet-squat'];
const RDL = ['romanian-deadlift', 'db-romanian-deadlift', 'back-extension'];
const LEG_CURL = ['leg-curl', 'db-romanian-deadlift', 'nordic-curl'];
const CALF = ['standing-calf-raise', 'seated-calf-raise'];
const ABS = ['hanging-knee-raise', 'cable-crunch', 'plank'];
const CRUNCH = ['cable-crunch', 'hanging-knee-raise', 'dead-bug'];

export const PRO_SPLITS: ProSplit[] = [
  {
    id: 'pro-arnold',
    person: 'Arnold Schwarzenegger',
    title: '7× Mr. Olympia',
    category: 'bodybuilder',
    era: '1970s',
    name: "Arnold's double split",
    tagline: 'Chest with back, shoulders with arms, then legs. Twice a week, very high volume.',
    daysPerWeek: 6,
    schedule: '6 days on, Sunday off. Each day comes round twice a week.',
    techniques: [
      'Supersets opposing muscles: bench press straight into pull-ups, little rest between.',
      'High volume, often 20 or more sets for a muscle in one session.',
      'Calves and abs trained almost every day.',
    ],
    source: 'As he laid it out in his Encyclopedia of Modern Bodybuilding and interviews from the era.',
    sessions: [
      {
        title: 'Chest & Back',
        short: 'Chest/Back',
        slots: [
          main('ar-bench', 'hpush', BENCH),
          main('ar-pullup', 'vpull', PULLUP),
          extra('ar-incline', 'hpush', INCLINE),
          extra('ar-row', 'hpull', ROW),
          extra('ar-fly', 'hpush', FLY),
          extra('ar-pullover', 'vpull', PULLOVER),
          extra('ar-abs1', 'core', ABS),
        ],
        supersets: [
          ['ar-bench', 'ar-pullup'],
          ['ar-incline', 'ar-row'],
        ],
      },
      {
        title: 'Shoulders & Arms',
        short: 'Arms',
        slots: [
          main('ar-press', 'vpush', PRESS),
          extra('ar-lateral', 'shoulders', LATERAL),
          extra('ar-curl', 'arms', CURL),
          extra('ar-ext', 'arms', OVERHEAD_EXT),
          extra('ar-rear', 'shoulders', REAR),
          extra('ar-hammer', 'arms', HAMMER),
          extra('ar-calves1', 'calves', CALF),
        ],
        supersets: [['ar-curl', 'ar-ext']],
      },
      {
        title: 'Legs',
        slots: [
          main('ar-squat', 'knee', SQUAT),
          main('ar-rdl', 'hip', RDL),
          extra('ar-legpress', 'knee', LEG_PRESS),
          extra('ar-legext', 'knee', LEG_EXT),
          extra('ar-legcurl', 'hip', LEG_CURL),
          extra('ar-calves2', 'calves', CALF),
          extra('ar-abs2', 'core', CRUNCH),
        ],
        supersets: [['ar-legext', 'ar-legcurl']],
      },
    ],
  },
  {
    id: 'pro-coleman',
    person: 'Ronnie Coleman',
    title: '8× Mr. Olympia',
    category: 'bodybuilder',
    era: '1990s–2000s',
    name: "Ronnie's 6-day split",
    tagline: 'Back, biceps and shoulders; legs; chest and triceps. Heavy compounds, every muscle twice a week.',
    daysPerWeek: 6,
    schedule: '6 days on, Sunday off. The second round of the week changes the focus.',
    techniques: [
      'Built on very heavy squats, rows and presses before any isolation work.',
      'Each muscle twice a week, with the second session leaning on different exercises.',
      'Lots of sets: he often ran 4 or 5 working sets on his big lifts.',
    ],
    source: 'The most common version across interviews and his training videos; the order varies by year.',
    sessions: [
      {
        title: 'Back, Biceps & Shoulders',
        short: 'Back',
        slots: [
          main('rc-row', 'hpull', ROW),
          main('rc-pulldown', 'vpull', PULLDOWN),
          extra('rc-press', 'vpush', DB_PRESS),
          extra('rc-dbrow', 'hpull', DB_ROW),
          extra('rc-lateral', 'shoulders', LATERAL),
          extra('rc-curl', 'arms', CURL),
          extra('rc-hammer', 'arms', HAMMER),
        ],
      },
      {
        title: 'Legs',
        slots: [
          main('rc-squat', 'knee', SQUAT),
          main('rc-legpress', 'knee', LEG_PRESS),
          extra('rc-rdl', 'hip', RDL),
          extra('rc-legext', 'knee', LEG_EXT),
          extra('rc-legcurl', 'hip', LEG_CURL),
          extra('rc-calves', 'calves', CALF),
        ],
      },
      {
        title: 'Chest & Triceps',
        short: 'Chest',
        slots: [
          main('rc-bench', 'hpush', BENCH),
          extra('rc-incline', 'hpush', INCLINE),
          extra('rc-dbbench', 'hpush', ['db-bench-press', 'machine-chest-press', 'push-up']),
          extra('rc-fly', 'hpush', FLY),
          extra('rc-ext', 'arms', OVERHEAD_EXT),
          extra('rc-dip', 'hpush', DIP),
        ],
      },
    ],
  },
  {
    id: 'pro-yates',
    person: 'Dorian Yates',
    title: '6× Mr. Olympia',
    category: 'bodybuilder',
    era: '1990s',
    name: "Dorian's Blood & Guts",
    tagline: 'Four short sessions a week. One all-out working set per exercise after warm-ups.',
    daysPerWeek: 4,
    schedule: '2 days on, 1 off, 2 on, 2 off.',
    techniques: [
      'High-intensity training: warm-up sets, then one working set taken to failure.',
      'Forced reps or a slow negative on that last set.',
      'Strict, controlled lowering on every rep.',
    ],
    source: 'From his Blood & Guts training videos and books.',
    sessions: [
      {
        title: 'Shoulders & Triceps',
        short: 'Shoulders',
        slots: [
          main('dy-press', 'vpush', DB_PRESS),
          extra('dy-lateral', 'shoulders', LATERAL),
          extra('dy-rear', 'shoulders', ['reverse-pec-deck', 'rear-delt-fly', 'face-pull']),
          extra('dy-pushdown', 'arms', PUSHDOWN),
          extra('dy-ext', 'arms', OVERHEAD_EXT),
        ],
      },
      {
        title: 'Back',
        slots: [
          main('dy-pulldown', 'vpull', PULLDOWN),
          main('dy-row', 'hpull', ROW),
          extra('dy-dbrow', 'hpull', DB_ROW),
          extra('dy-rear2', 'shoulders', REAR),
          extra('dy-lowback', 'hip', ['back-extension', 'romanian-deadlift', 'db-romanian-deadlift']),
        ],
      },
      {
        title: 'Chest & Biceps',
        short: 'Chest',
        slots: [
          main('dy-incline', 'hpush', INCLINE),
          extra('dy-machine', 'hpush', ['machine-chest-press', 'db-bench-press', 'push-up']),
          extra('dy-fly', 'hpush', FLY),
          extra('dy-curl', 'arms', CURL),
          extra('dy-cablecurl', 'arms', CABLE_CURL),
        ],
      },
      {
        title: 'Legs',
        slots: [
          extra('dy-legext', 'knee', LEG_EXT),
          main('dy-legpress', 'knee', LEG_PRESS),
          extra('dy-hack', 'knee', HACK),
          extra('dy-legcurl', 'hip', LEG_CURL),
          extra('dy-rdl', 'hip', RDL),
          extra('dy-calves', 'calves', CALF),
        ],
      },
    ],
  },
  {
    id: 'pro-zane',
    person: 'Frank Zane',
    title: '3× Mr. Olympia',
    category: 'bodybuilder',
    era: '1970s',
    name: "Zane's 3-way split",
    tagline: 'Back and biceps; legs and abs; chest, shoulders and triceps. Symmetry over size.',
    daysPerWeek: 5,
    schedule: '3 days on, 1 off, so the week rolls rather than repeats.',
    techniques: [
      'Moderate weights, strict form and slow negatives over heavy singles.',
      'Abs most days.',
      'Three on, one off, so every muscle gets about five days to recover.',
    ],
    source: 'From his books and the routine he has described in interviews.',
    sessions: [
      {
        title: 'Back & Biceps',
        short: 'Back',
        slots: [
          main('fz-pulldown', 'vpull', PULLDOWN),
          main('fz-row', 'hpull', DB_ROW),
          extra('fz-cablerow', 'hpull', CABLE_ROW),
          extra('fz-pullover', 'vpull', PULLOVER),
          extra('fz-curl', 'arms', CURL),
          extra('fz-hammer', 'arms', HAMMER),
        ],
      },
      {
        title: 'Legs & Abs',
        short: 'Legs',
        slots: [
          main('fz-hack', 'knee', HACK),
          extra('fz-legext', 'knee', LEG_EXT),
          extra('fz-legcurl', 'hip', LEG_CURL),
          extra('fz-calves', 'calves', CALF),
          extra('fz-crunch', 'core', CRUNCH),
          extra('fz-knee', 'core', ABS),
        ],
      },
      {
        title: 'Chest, Shoulders & Triceps',
        short: 'Push',
        slots: [
          main('fz-bench', 'hpush', BENCH),
          extra('fz-incline', 'hpush', INCLINE),
          extra('fz-fly', 'hpush', FLY),
          extra('fz-press', 'vpush', DB_PRESS),
          extra('fz-lateral', 'shoulders', LATERAL),
          extra('fz-pushdown', 'arms', PUSHDOWN),
          extra('fz-ext', 'arms', OVERHEAD_EXT),
        ],
      },
    ],
  },
  {
    id: 'pro-mentzer',
    person: 'Mike Mentzer',
    title: 'Mr. Universe 1978',
    category: 'bodybuilder',
    era: '1970s–80s',
    name: "Mentzer's Heavy Duty",
    tagline: 'Few exercises, one set each, to total failure. Then rest longer than you think.',
    daysPerWeek: 3,
    schedule: 'A rest day or more between sessions. Later in his career, a week apart.',
    techniques: [
      'One working set per exercise, taken past failure.',
      'Pre-exhaust: an isolation move goes straight into a compound with no rest.',
      'Recovery is the point: train again only when you feel fully fresh.',
    ],
    source: 'From his Heavy Duty books. Repwise keeps your usual set count; make the last set your all-out one.',
    sessions: [
      {
        title: 'Chest & Back',
        short: 'Chest/Back',
        slots: [
          extra('mm-fly', 'hpush', FLY),
          main('mm-incline', 'hpush', INCLINE),
          extra('mm-pullover', 'vpull', PULLOVER),
          main('mm-pulldown', 'vpull', ['chin-up', 'lat-pulldown', 'pull-up']),
          extra('mm-row', 'hpull', ROW),
        ],
        supersets: [
          ['mm-fly', 'mm-incline'],
          ['mm-pullover', 'mm-pulldown'],
        ],
      },
      {
        title: 'Legs',
        slots: [
          extra('mm-legext', 'knee', LEG_EXT),
          main('mm-legpress', 'knee', LEG_PRESS),
          extra('mm-legcurl', 'hip', LEG_CURL),
          extra('mm-calves', 'calves', CALF),
        ],
        supersets: [['mm-legext', 'mm-legpress']],
      },
      {
        title: 'Shoulders & Arms',
        short: 'Arms',
        slots: [
          extra('mm-lateral', 'shoulders', LATERAL),
          extra('mm-rear', 'shoulders', REAR),
          extra('mm-curl', 'arms', CABLE_CURL),
          extra('mm-pushdown', 'arms', PUSHDOWN),
          extra('mm-dip', 'hpush', DIP),
        ],
        supersets: [['mm-pushdown', 'mm-dip']],
      },
    ],
  },
  {
    id: 'pro-cutler',
    person: 'Jay Cutler',
    title: '4× Mr. Olympia',
    category: 'bodybuilder',
    era: '2000s',
    name: "Cutler's 5-day split",
    tagline: 'One muscle group a day, high volume, plenty of machines.',
    daysPerWeek: 5,
    schedule: '5 days on, 2 off.',
    techniques: [
      'One body part per session so each gets full attention.',
      'Leg day opens with leg extensions to warm the knees before heavy pressing.',
      'Arms get a day of their own.',
    ],
    source: 'A classic body-part week drawn from his interviews and training videos; his exact days changed over the years.',
    inspired: true,
    sessions: [
      {
        title: 'Chest',
        slots: [
          main('jc-incline', 'hpush', INCLINE),
          main('jc-bench', 'hpush', BENCH),
          extra('jc-machine', 'hpush', ['machine-chest-press', 'db-bench-press', 'push-up']),
          extra('jc-fly', 'hpush', FLY),
          extra('jc-dip', 'hpush', DIP),
        ],
      },
      {
        title: 'Back',
        slots: [
          main('jc-pulldown', 'vpull', PULLDOWN),
          main('jc-row', 'hpull', ROW),
          extra('jc-cablerow', 'hpull', CABLE_ROW),
          extra('jc-dbrow', 'hpull', DB_ROW),
          extra('jc-pullover', 'vpull', PULLOVER),
          extra('jc-lowback', 'hip', ['back-extension', 'romanian-deadlift', 'db-romanian-deadlift']),
        ],
      },
      {
        title: 'Shoulders',
        slots: [
          main('jc-press', 'vpush', DB_PRESS),
          extra('jc-lateral', 'shoulders', LATERAL),
          extra('jc-cablelat', 'shoulders', ['cable-lateral-raise', 'db-lateral-raise']),
          extra('jc-rear', 'shoulders', REAR),
          extra('jc-facepull', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
        ],
      },
      {
        title: 'Legs',
        slots: [
          extra('jc-legext', 'knee', LEG_EXT),
          main('jc-hack', 'knee', HACK),
          main('jc-legpress', 'knee', LEG_PRESS),
          extra('jc-legcurl', 'hip', LEG_CURL),
          extra('jc-rdl', 'hip', RDL),
          extra('jc-calves', 'calves', CALF),
        ],
      },
      {
        title: 'Arms',
        slots: [
          extra('jc-curl', 'arms', CURL),
          extra('jc-pushdown', 'arms', PUSHDOWN),
          extra('jc-hammer', 'arms', HAMMER),
          extra('jc-ext', 'arms', OVERHEAD_EXT),
          extra('jc-cablecurl', 'arms', CABLE_CURL),
        ],
        supersets: [
          ['jc-curl', 'jc-pushdown'],
          ['jc-hammer', 'jc-ext'],
        ],
      },
    ],
  },
  {
    id: 'pro-bumstead',
    person: 'Chris Bumstead',
    title: '6× Classic Physique Olympia',
    category: 'bodybuilder',
    era: '2020s',
    name: "CBum's 3-on-1-off",
    tagline: 'Six sessions on a rolling 3-on, 1-off cycle. Hamstrings get their own day.',
    daysPerWeek: 5,
    schedule: '3 days on, 1 off, 3 on, 1 off. The cycle rolls across the calendar.',
    techniques: [
      'Quads and hamstrings on separate days so each leg day can go hard.',
      'Moderate weights with a full stretch and a hard squeeze.',
      'A rolling cycle rather than fixed weekdays.',
    ],
    source: 'The split he shared on his YouTube channel ahead of the 2020 Olympia; later years moved days around.',
    sessions: [
      {
        title: 'Chest',
        slots: [
          main('cb-incline', 'hpush', INCLINE),
          main('cb-machine', 'hpush', ['machine-chest-press', 'bench-press', 'db-bench-press', 'push-up']),
          extra('cb-dbbench', 'hpush', ['db-bench-press', 'bench-press', 'push-up']),
          extra('cb-fly', 'hpush', FLY),
          extra('cb-dip', 'hpush', DIP),
        ],
      },
      {
        title: 'Quads & Calves',
        short: 'Quads',
        slots: [
          main('cb-squat', 'knee', SQUAT),
          extra('cb-legpress', 'knee', LEG_PRESS),
          extra('cb-legext', 'knee', LEG_EXT),
          extra('cb-split', 'knee', SPLIT_SQUAT),
          extra('cb-calves', 'calves', CALF),
          extra('cb-seatcalf', 'calves', ['seated-calf-raise', 'standing-calf-raise']),
        ],
      },
      {
        title: 'Back',
        slots: [
          main('cb-pulldown', 'vpull', PULLDOWN),
          main('cb-row', 'hpull', ['chest-supported-row', 'barbell-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          extra('cb-dbrow', 'hpull', DB_ROW),
          extra('cb-pullover', 'vpull', PULLOVER),
          extra('cb-cablerow', 'hpull', CABLE_ROW),
        ],
      },
      {
        title: 'Shoulders',
        slots: [
          main('cb-press', 'vpush', DB_PRESS),
          extra('cb-lateral', 'shoulders', LATERAL),
          extra('cb-cablelat', 'shoulders', ['cable-lateral-raise', 'db-lateral-raise']),
          extra('cb-rear', 'shoulders', ['reverse-pec-deck', 'rear-delt-fly', 'face-pull']),
          extra('cb-facepull', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
        ],
      },
      {
        title: 'Hamstrings & Back',
        short: 'Hams',
        slots: [
          extra('cb-legcurl', 'hip', LEG_CURL),
          main('cb-rdl', 'hip', RDL),
          main('cb-pullup', 'vpull', PULLUP),
          extra('cb-bbrow', 'hpull', ROW),
          extra('cb-lowback', 'hip', ['back-extension', 'db-romanian-deadlift', 'cable-pull-through']),
        ],
      },
      {
        title: 'Arms',
        slots: [
          extra('cb-cablecurl', 'arms', CABLE_CURL),
          extra('cb-pushdown', 'arms', PUSHDOWN),
          extra('cb-hammer', 'arms', HAMMER),
          extra('cb-ext', 'arms', OVERHEAD_EXT),
          extra('cb-curl', 'arms', CURL),
        ],
        supersets: [['cb-cablecurl', 'cb-pushdown']],
      },
    ],
  },
  {
    id: 'pro-reeves',
    person: 'Steve Reeves',
    title: 'Mr. Universe 1950',
    category: 'bodybuilder',
    era: '1940s–50s',
    name: "Reeves' full body",
    tagline: 'The whole body, three days a week, built for proportion rather than bulk.',
    daysPerWeek: 3,
    schedule: 'Monday, Wednesday, Friday. A rest day between each.',
    techniques: [
      'Every muscle, every session, three sets per exercise.',
      'Moves briskly from one exercise to the next.',
      'Aimed for classic proportions: arms, calves and neck about the same size.',
    ],
    source: 'From his book Building the Classic Physique the Natural Way.',
    sessions: [
      {
        title: 'Full Body',
        slots: [
          main('sr-squat', 'knee', SQUAT),
          main('sr-incline', 'hpush', INCLINE),
          main('sr-pullup', 'vpull', PULLUP),
          extra('sr-press', 'vpush', PRESS),
          extra('sr-row', 'hpull', ROW),
          extra('sr-curl', 'arms', CURL),
          extra('sr-ext', 'arms', OVERHEAD_EXT),
          extra('sr-legcurl', 'hip', LEG_CURL),
          extra('sr-calves', 'calves', CALF),
        ],
      },
    ],
  },
  {
    id: 'pro-park',
    person: 'Reg Park',
    title: '3× Mr. Universe',
    category: 'bodybuilder',
    era: '1950s–60s',
    name: "Park's 5×5",
    tagline: 'Squat, bench and deadlift three times a week. Strength first, size follows.',
    daysPerWeek: 3,
    schedule: 'Three full-body sessions a week, a day apart.',
    techniques: [
      'Five sets of five on the main lifts, adding weight when all 25 reps go.',
      'Two warm-up sets, then three heavy sets at the same weight.',
      'Assistance work stays short.',
    ],
    source: 'From his 5×5 strength course. Repwise has no conventional deadlift yet, so Romanian deadlift stands in. Set Goal to Get stronger for heavier, lower-rep sets.',
    sessions: [
      {
        title: 'Full Body',
        slots: [
          main('rp-squat', 'knee', SQUAT),
          main('rp-bench', 'hpush', BENCH),
          main('rp-dead', 'hip', RDL),
          extra('rp-press', 'vpush', PRESS),
          extra('rp-row', 'hpull', ROW),
          extra('rp-chin', 'vpull', ['chin-up', 'pull-up', 'lat-pulldown']),
        ],
      },
    ],
  },
  {
    id: 'pro-rock',
    person: 'Dwayne Johnson',
    title: 'Actor, former WWE champion',
    category: 'hollywood',
    era: '2020s',
    name: "The Rock's 6-day split",
    tagline: 'Body-part training with back twice a week, machines, and a lot of volume.',
    daysPerWeek: 6,
    schedule: '6 days on, Sunday off. Cardio most mornings on top.',
    techniques: [
      'Back and biceps twice a week; every other muscle once.',
      'Machine and cable heavy, with high reps and short rests.',
      'Fasted cardio most mornings before lifting.',
    ],
    source: 'His Black Adam-era week as reported by Men’s Health. His routine changes with each role.',
    inspired: true,
    sessions: [
      {
        title: 'Back & Biceps A',
        short: 'Back',
        slots: [
          main('dj-pullup', 'vpull', PULLUP),
          main('dj-dbrow', 'hpull', DB_ROW),
          extra('dj-pulldown', 'vpull', PULLDOWN),
          extra('dj-cablerow', 'hpull', CABLE_ROW),
          extra('dj-curl', 'arms', CURL),
          extra('dj-hammer', 'arms', HAMMER),
        ],
      },
      {
        title: 'Shoulders',
        slots: [
          main('dj-press', 'vpush', DB_PRESS),
          extra('dj-machine', 'vpush', ['machine-shoulder-press', 'seated-db-press', 'pike-push-up']),
          extra('dj-lateral', 'shoulders', LATERAL),
          extra('dj-rear', 'shoulders', REAR),
          extra('dj-facepull', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
        ],
      },
      {
        title: 'Upper Body & Abs',
        short: 'Upper',
        slots: [
          main('dj-dbbench', 'hpush', ['db-bench-press', 'machine-chest-press', 'push-up']),
          main('dj-csrow', 'hpull', ['chest-supported-row', 'seated-cable-row', 'one-arm-db-row', 'inverted-row']),
          extra('dj-crunch', 'core', CRUNCH),
          extra('dj-knee', 'core', ABS),
          extra('dj-plank', 'core', ['plank', 'dead-bug']),
        ],
      },
      {
        title: 'Back & Biceps B',
        short: 'Back',
        slots: [
          main('dj-pulldown2', 'vpull', PULLDOWN),
          main('dj-row2', 'hpull', ROW),
          extra('dj-pullover', 'vpull', PULLOVER),
          extra('dj-cablecurl', 'arms', CABLE_CURL),
          extra('dj-hammer2', 'arms', HAMMER),
        ],
      },
      {
        title: 'Chest & Triceps',
        short: 'Chest',
        slots: [
          main('dj-incline', 'hpush', INCLINE),
          extra('dj-chestmachine', 'hpush', ['machine-chest-press', 'db-bench-press', 'push-up']),
          extra('dj-fly', 'hpush', FLY),
          extra('dj-pushdown', 'arms', PUSHDOWN),
          extra('dj-ext', 'arms', OVERHEAD_EXT),
          extra('dj-dip', 'hpush', DIP),
        ],
      },
      {
        title: 'Legs',
        slots: [
          main('dj-legpress', 'knee', LEG_PRESS),
          extra('dj-hack', 'knee', HACK),
          extra('dj-lunge', 'knee', LUNGE),
          extra('dj-legcurl', 'hip', LEG_CURL),
          extra('dj-legext', 'knee', LEG_EXT),
          extra('dj-calves', 'calves', CALF),
        ],
      },
    ],
  },
  {
    id: 'pro-jackman',
    person: 'Hugh Jackman',
    title: 'Actor, Wolverine',
    category: 'hollywood',
    era: '2010s',
    name: "Wolverine's big four",
    tagline: 'One heavy main lift a day, then quick accessory supersets.',
    daysPerWeek: 4,
    schedule: '4 days a week, each built around one main lift.',
    techniques: [
      'The main lift is heavy and low-rep, worked from a percentage of his best.',
      'Accessories in supersets to keep sessions short.',
      'Progress over weeks: the main-lift weights climb in small steps.',
    ],
    source: 'As his trainer described the Wolverine prep in interviews. Romanian deadlift stands in for the conventional deadlift.',
    inspired: true,
    sessions: [
      {
        title: 'Squat Day',
        short: 'Squat',
        slots: [
          main('hj-squat', 'knee', SQUAT),
          extra('hj-split', 'knee', SPLIT_SQUAT),
          extra('hj-legcurl', 'hip', LEG_CURL),
          extra('hj-calves', 'calves', CALF),
          extra('hj-abs', 'core', ABS),
        ],
        supersets: [['hj-split', 'hj-legcurl']],
      },
      {
        title: 'Bench Day',
        short: 'Bench',
        slots: [
          main('hj-bench', 'hpush', BENCH),
          extra('hj-incline', 'hpush', INCLINE),
          extra('hj-dbrow', 'hpull', DB_ROW),
          extra('hj-dip', 'hpush', DIP),
          extra('hj-facepull', 'shoulders', ['face-pull', 'rear-delt-fly', 'reverse-pec-deck']),
        ],
        supersets: [['hj-incline', 'hj-dbrow']],
      },
      {
        title: 'Deadlift Day',
        short: 'Deadlift',
        slots: [
          main('hj-dead', 'hip', RDL),
          main('hj-pullup', 'vpull', PULLUP),
          extra('hj-row', 'hpull', ROW),
          extra('hj-lowback', 'hip', ['back-extension', 'db-romanian-deadlift', 'cable-pull-through']),
          extra('hj-hammer', 'arms', HAMMER),
        ],
        supersets: [['hj-row', 'hj-hammer']],
      },
      {
        title: 'Press Day',
        short: 'Press',
        slots: [
          main('hj-press', 'vpush', PRESS),
          main('hj-chin', 'vpull', ['chin-up', 'pull-up', 'lat-pulldown']),
          extra('hj-lateral', 'shoulders', LATERAL),
          extra('hj-curl', 'arms', CURL),
          extra('hj-pushdown', 'arms', PUSHDOWN),
        ],
        supersets: [['hj-curl', 'hj-pushdown']],
      },
    ],
  },
  {
    id: 'pro-ronaldo',
    person: 'Cristiano Ronaldo',
    title: 'Footballer, 5× Ballon d’Or',
    category: 'athlete',
    era: '2010s–20s',
    name: 'Footballer power circuit',
    tagline: 'Leg power, a strong core and an athletic upper body, around pitch sessions.',
    daysPerWeek: 3,
    schedule: '3 gym sessions a week alongside sprints and team training.',
    techniques: [
      'Circuits: move from one exercise to the next with little rest.',
      'Plenty of hamstring and core work to stay injury-free.',
      'Sprints and pitch work on the other days.',
    ],
    source: 'Inspired by reports of his gym work. No verified program has been published; treat it as an athlete-style template.',
    inspired: true,
    sessions: [
      {
        title: 'Lower Power',
        short: 'Lower',
        slots: [
          main('cr-squat', 'knee', SQUAT),
          extra('cr-split', 'knee', SPLIT_SQUAT),
          extra('cr-legcurl', 'hip', ['nordic-curl', 'leg-curl', 'db-romanian-deadlift']),
          extra('cr-thrust', 'hip', ['hip-thrust', 'cable-pull-through', 'back-extension']),
          extra('cr-calves', 'calves', CALF),
          extra('cr-plank', 'core', ['plank', 'dead-bug']),
        ],
      },
      {
        title: 'Upper Strength',
        short: 'Upper',
        slots: [
          main('cr-bench', 'hpush', ['db-bench-press', 'bench-press', 'machine-chest-press', 'push-up']),
          main('cr-pullup', 'vpull', PULLUP),
          extra('cr-press', 'vpush', DB_PRESS),
          extra('cr-row', 'hpull', DB_ROW),
          extra('cr-dip', 'hpush', DIP),
          extra('cr-deadbug', 'core', ['dead-bug', 'plank', 'hanging-knee-raise']),
        ],
      },
      {
        title: 'Full-Body Circuit',
        short: 'Circuit',
        slots: [
          extra('cr-goblet', 'knee', ['goblet-squat', 'reverse-lunge', 'leg-press']),
          extra('cr-pushup', 'hpush', ['push-up', 'db-bench-press', 'machine-chest-press']),
          extra('cr-invrow', 'hpull', ['inverted-row', 'seated-cable-row', 'one-arm-db-row']),
          extra('cr-lunge', 'knee', LUNGE),
          extra('cr-knee', 'core', ABS),
          extra('cr-hold', 'core', ['plank', 'hollow-hold', 'dead-bug']),
        ],
        supersets: [
          ['cr-goblet', 'cr-pushup'],
          ['cr-invrow', 'cr-lunge'],
        ],
      },
    ],
  },
];

const byId = new Map(PRO_SPLITS.map((p) => [p.id, p]));

export function getProSplit(id: string): ProSplit | undefined {
  return byId.get(id as ProSplitId);
}
