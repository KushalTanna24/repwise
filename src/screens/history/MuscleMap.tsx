import { useMemo, useState, type ReactNode } from 'react';
import { MUSCLE_LABEL, MUSCLES, muscleHeat, type Heat, type Muscle } from '@/domain/muscles';
import type { AppData } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { fmtDay } from '@/lib/fmt';

const HOT = 'var(--color-red)';
const COLD = 'var(--color-label-3)';
const BODY = 'var(--color-fill)';

type Shape = { kind: 'e'; cx: number; cy: number; rx: number; ry: number } | { kind: 'r'; x: number; y: number; w: number; h: number; r: number } | { kind: 'p'; d: string };

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: 'e', cx, cy, rx, ry });
const r = (x: number, y: number, w: number, h: number, rad: number): Shape => ({ kind: 'r', x, y, w, h, r: rad });
const p = (d: string): Shape => ({ kind: 'p', d });
/** A shape on the left side and its mirror on the right of a 100-wide figure. */
const pair = (s: Shape): Shape[] => {
  if (s.kind === 'e') return [s, { ...s, cx: 100 - s.cx }];
  if (s.kind === 'r') return [s, { ...s, x: 100 - s.x - s.w }];
  return [s, { kind: 'p', d: s.d.replace(/(-?\d+(?:\.\d+)?),/g, (_, x: string) => `${100 - Number(x)},`) }];
};

/** Head, neck, hands, hips and feet: not muscles, just the outline. */
const FRAME: Shape[] = [e(50, 14, 9, 9), r(46, 22, 8, 6, 2), ...pair(e(18, 96, 3.5, 4)), r(36, 79, 28, 11, 5), ...pair(e(41, 181, 5, 3))];

const FRONT: [Muscle, Shape[]][] = [
  ['shoulders', pair(e(30, 37, 8, 7))],
  ['chest', pair(r(33, 30, 16, 15, 5))],
  ['biceps', pair(e(24, 56, 5, 10))],
  ['forearms', pair(e(20, 80, 4.5, 12))],
  ['abs', [r(42, 48, 16, 30, 5)]],
  ['obliques', pair(r(34, 50, 7, 24, 3.5))],
  ['quads', pair(e(42, 112, 8.5, 22))],
  ['calves', pair(e(41, 159, 5.5, 17))],
];

const BACK: [Muscle, Shape[]][] = [
  ['traps', [p('M50,24 L64,33 L56,50 L44,50 L36,33 Z')]],
  ['rear-delts', pair(e(30, 37, 8, 7))],
  ['lats', pair(p('M36,40 L43,50 L44,72 L39,74 L33,56 Z'))],
  ['triceps', pair(e(24, 56, 5, 10))],
  ['forearms', pair(e(20, 80, 4.5, 12))],
  ['lower-back', [r(45, 58, 10, 20, 4)]],
  ['glutes', pair(e(43, 89, 8, 8))],
  ['hamstrings', pair(e(42, 118, 8, 18))],
  ['calves', pair(e(41, 157, 6, 15))],
];

function draw(s: Shape, i: number, props: React.SVGProps<SVGElement>): ReactNode {
  if (s.kind === 'e') return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...(props as React.SVGProps<SVGEllipseElement>)} />;
  if (s.kind === 'r') return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...(props as React.SVGProps<SVGRectElement>)} />;
  return <path key={i} d={s.d} strokeLinejoin="round" {...(props as React.SVGProps<SVGPathElement>)} />;
}

const fmtSets = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

function Figure({ label, parts, heat, selected, onSelect }: { label: string; parts: [Muscle, Shape[]][]; heat: Record<Muscle, Heat>; selected: Muscle | null; onSelect: (m: Muscle) => void }) {
  return (
    <figure className="flex flex-1 flex-col items-center">
      <svg viewBox="0 0 100 190" className="h-56 w-auto" role="group" aria-label={`${label} muscles`}>
        {FRAME.map((s, i) => draw(s, i, { fill: BODY }))}
        {parts.map(([m, shapes]) => {
          const h = heat[m].heat;
          const on = selected === m;
          return (
            <g
              key={m}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${MUSCLE_LABEL[m]}, ${fmtSets(heat[m].sets)} sets in the last 7 days`}
              onClick={() => onSelect(m)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelect(m))}
              className="cursor-pointer outline-none [&>*]:transition-[fill-opacity] [&>*]:duration-300 motion-reduce:[&>*]:transition-none focus-visible:[&>*]:stroke-blue"
            >
              {shapes.map((s, i) =>
                draw(s, i, {
                  fill: h > 0 ? HOT : COLD,
                  fillOpacity: h > 0 ? 0.2 + 0.8 * h : 0.5,
                  stroke: on ? 'var(--color-label)' : 'transparent',
                  strokeWidth: 1.2,
                }),
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-caption font-semibold uppercase tracking-wide text-label-2">{label}</figcaption>
    </figure>
  );
}

/** Front and back body, each muscle lit by last week's sets and fading as the days pass. */
export function MuscleMap({ data, today }: { data: AppData; today: string }) {
  const heat = useMemo(() => muscleHeat(data, today), [data, today]);
  const [selected, setSelected] = useState<Muscle | null>(null);
  const top = MUSCLES.filter((m) => heat[m].heat > 0)
    .sort((a, b) => heat[b].heat - heat[a].heat)
    .slice(0, 3);
  const pick = (m: Muscle) => setSelected(selected === m ? null : m);
  const h = selected ? heat[selected] : null;

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-headline font-semibold">Muscles</h2>
        <span className="text-footnote text-label-2">Last 7 days</span>
      </div>
      <div className="mt-2 flex">
        <Figure label="Front" parts={FRONT} heat={heat} selected={selected} onSelect={pick} />
        <Figure label="Back" parts={BACK} heat={heat} selected={selected} onSelect={pick} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-caption text-label-2" aria-hidden>
        <span>Fading</span>
        <span className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, color-mix(in srgb, ${HOT} 20%, transparent), ${HOT})` }} />
        <span>Fresh</span>
      </div>
      <p className={cn('mt-3 min-h-10 text-subhead', !selected && 'text-label-2')} aria-live="polite">
        {selected && h ? (
          <>
            <span className="font-semibold">{MUSCLE_LABEL[selected]}</span>
            <span className="text-label-2">
              {' '}
              · {fmtSets(h.sets)} {h.sets === 1 ? 'set' : 'sets'} this week · {h.last ? `last trained ${fmtDay(h.last).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())}` : 'not trained yet'}
            </span>
          </>
        ) : top.length ? (
          `Most worked: ${top.map((m) => MUSCLE_LABEL[m]).join(', ')}. Tap a muscle for details.`
        ) : (
          'Nothing trained in the last 7 days. Muscles light up as you log sets.'
        )}
      </p>
    </Card>
  );
}
